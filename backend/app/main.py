import json
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Depends, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from faster_whisper import WhisperModel

from .auth import require_user, supabase_client
from .config import MEDIA_DIR, FFMPEG_BIN
from .gemini_service import ask_persona
from .tts_service import generate_xtts, ensure_xtts_server, normalize_reference
from .jobs import init_db, create_job, get_job, delete_jobs_for_persona, cancel_job

app = FastAPI(title="PersonaTwin API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MEDIA_DIR.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")
init_db()
ensure_xtts_server()

# Multilingual Whisper model on D: drive (small model provides high Indic script accuracy)
WHISPER_DIR = Path(r"D:\models\whisper")
WHISPER_DIR.mkdir(parents=True, exist_ok=True)
_whisper_model = None

WHISPER_PROMPTS = {
    "hi": "नमस्ते, आप कैसे हैं? कृपया हिंदी में बातचीत करें।",
    "bn": "নমস্কার, কেমন আছেন? আমরা বাংলায় কথা বলছি।",
    "en": "Hello, how are you? Let's have a conversation in English.",
}


def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        print("[Whisper] Loading 'small' multilingual model from D:\\models\\whisper...")
        try:
            _whisper_model = WhisperModel(
                "small",
                device="cpu",
                compute_type="int8",
                download_root=str(WHISPER_DIR),
            )
            print("[Whisper] High-accuracy multilingual model ready.")
        except Exception as e:
            print(f"[Whisper] Failed loading small model ({e}), falling back to base...")
            _whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
    return _whisper_model


class ChatRequest(BaseModel):
    persona_id: str
    message: str
    language: Optional[str] = None


@app.get("/health")
def health():
    return {"ok": True, "service": "personatwin-api"}


def resolve_media_path(raw_path: str | Path | None) -> Path | None:
    if not raw_path:
        return None
    raw_str = str(raw_path).replace("\\", "/")
    direct = Path(raw_path)
    if direct.exists():
        return direct
    if "/media/" in raw_str:
        rel = raw_str.split("/media/", 1)[1]
        cand = MEDIA_DIR / rel
        if cand.exists():
            return cand
        for ext in [".wav", ".mp3", ".m4a", ".webm", ".ogg", ".png", ".jpg", ".jpeg"]:
            cand_ext = cand.with_suffix(ext)
            if cand_ext.exists():
                return cand_ext
    if "users/" in raw_str:
        user_rel = raw_str.split("users/", 1)[1]
        cand = MEDIA_DIR / "users" / user_rel
        if cand.exists():
            return cand
        for ext in [".wav", ".mp3", ".m4a", ".webm", ".ogg", ".png", ".jpg", ".jpeg"]:
            cand_ext = cand.with_suffix(ext)
            if cand_ext.exists():
                return cand_ext
    cand = MEDIA_DIR / direct.name
    if cand.exists():
        return cand
    for ext in [".wav", ".mp3", ".m4a", ".webm", ".ogg", ".png", ".jpg", ".jpeg"]:
        cand_ext = cand.with_suffix(ext)
        if cand_ext.exists():
            return cand_ext
    return direct if direct.exists() else None


def get_media_url(raw_path: str | Path | None) -> str | None:
    resolved = resolve_media_path(raw_path)
    if not resolved or not resolved.exists():
        return None
    try:
        rel = resolved.relative_to(MEDIA_DIR).as_posix()
        return f"/media/{rel}"
    except Exception:
        return None


@app.get("/api/personas")
def list_personas(user=Depends(require_user)):
    data = (
        supabase_client()
        .table("personas")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=False)
        .execute()
        .data
        or []
    )
    for p in data:
        p["photo_url"] = get_media_url(p.get("photo_path"))
        p["voice_url"] = get_media_url(p.get("voice_path"))
    return data


@app.post("/api/personas")
async def create_persona(
    name: str = Form(...),
    tone: str = Form("casual"),
    style: str = Form("friendly, direct, concise"),
    humor: str = Form("light"),
    notes: str = Form(""),
    language: str = Form("en"),
    photo: UploadFile | None = File(default=None),
    voice: UploadFile | None = File(default=None),
    user=Depends(require_user),
):
    persona_id = str(uuid.uuid4())
    folder = MEDIA_DIR / "users" / str(user.id) / persona_id
    folder.mkdir(parents=True, exist_ok=True)

    photo_path = None
    voice_path = None

    if photo and photo.filename:
        suffix = Path(photo.filename or ".png").suffix or ".png"
        new_photo = folder / f"photo{suffix}"
        new_photo.write_bytes(await photo.read())
        photo_path = str(new_photo.resolve())

    if voice and voice.filename:
        suffix = Path(voice.filename or ".wav").suffix or ".wav"
        new_voice = folder / f"voice{suffix}"
        new_voice.write_bytes(await voice.read())
        voice_path = str(new_voice.resolve())
        try:
            normalize_reference(new_voice, force=True)
        except Exception as e:
            print(f"[Create Persona] Pre-normalize error: {e}")

    row = {
        "id": persona_id,
        "user_id": user.id,
        "name": name,
        "tone": tone,
        "style": style,
        "humor": humor,
        "notes": notes,
        "language": language,
        "photo_path": photo_path,
        "voice_path": voice_path,
    }

    created = supabase_client().table("personas").insert(row).execute().data[0]
    created["photo_url"] = get_media_url(created.get("photo_path"))
    created["voice_url"] = get_media_url(created.get("voice_path"))
    return created


@app.get("/api/personas/{persona_id}")
def get_persona(persona_id: str, user=Depends(require_user)):
    p = (
        supabase_client()
        .table("personas")
        .select("*")
        .eq("id", persona_id)
        .eq("user_id", user.id)
        .single()
        .execute()
        .data
    )
    if not p:
        raise HTTPException(404, "Persona not found")
    p["photo_url"] = get_media_url(p.get("photo_path"))
    p["voice_url"] = get_media_url(p.get("voice_path"))
    return p


@app.get("/api/personas/{persona_id}/messages")
def get_persona_messages(persona_id: str, user=Depends(require_user)):
    data = (
        supabase_client()
        .table("messages")
        .select("id,role,content,created_at")
        .eq("persona_id", persona_id)
        .eq("user_id", user.id)
        .order("created_at", desc=False)
        .execute()
        .data
        or []
    )
    return data


@app.put("/api/personas/{persona_id}")
@app.post("/api/personas/{persona_id}")
async def update_persona(
    persona_id: str,
    name: str = Form(...),
    tone: str = Form("casual"),
    style: str = Form("friendly, direct, concise"),
    humor: str = Form("light"),
    notes: str = Form(""),
    language: str = Form("en"),
    photo: UploadFile | None = File(default=None),
    voice: UploadFile | None = File(default=None),
    user=Depends(require_user),
):
    persona = (
        supabase_client()
        .table("personas")
        .select("*")
        .eq("id", persona_id)
        .eq("user_id", user.id)
        .single()
        .execute()
        .data
    )
    if not persona:
        raise HTTPException(404, "Persona not found")

    folder = MEDIA_DIR / "users" / str(user.id) / persona_id
    folder.mkdir(parents=True, exist_ok=True)

    photo_path = persona.get("photo_path")
    voice_path = persona.get("voice_path")

    if photo and photo.filename:
        for old_photo in folder.glob("photo*"):
            try:
                old_photo.unlink(missing_ok=True)
            except Exception:
                pass

        suffix = Path(photo.filename or ".png").suffix or ".png"
        new_photo = folder / f"photo{suffix}"
        new_photo.write_bytes(await photo.read())
        photo_path = str(new_photo.resolve())

        # Clear cached 3D face mesh so SadTalker re-extracts with the new photo
        cache_dir = folder / "sadtalker_cache"
        if cache_dir.exists():
            shutil.rmtree(cache_dir, ignore_errors=True)

    if voice and voice.filename:
        # Purge ALL previous voice files and normalized caches in folder
        for old_voice in folder.glob("voice*"):
            try:
                old_voice.unlink(missing_ok=True)
            except Exception:
                pass
        for old_norm in folder.glob("*_norm.wav"):
            try:
                old_norm.unlink(missing_ok=True)
            except Exception:
                pass

        suffix = Path(voice.filename or ".wav").suffix or ".wav"
        new_voice = folder / f"voice{suffix}"
        new_voice.write_bytes(await voice.read())
        voice_path = str(new_voice.resolve())

        # Pre-generate fresh normalized audio cache immediately
        try:
            normalize_reference(new_voice, force=True)
        except Exception as e:
            print(f"[Persona Update] Pre-normalize voice error: {e}")

    updates = {
        "name": name,
        "tone": tone,
        "style": style,
        "humor": humor,
        "notes": notes,
        "language": language,
        "photo_path": photo_path,
        "voice_path": voice_path,
    }

    updated = (
        supabase_client()
        .table("personas")
        .update(updates)
        .eq("id", persona_id)
        .eq("user_id", user.id)
        .execute()
        .data[0]
    )

    updated["photo_url"] = get_media_url(updated.get("photo_path"))
    updated["voice_url"] = get_media_url(updated.get("voice_path"))
    return updated


@app.delete("/api/personas/{persona_id}")
def delete_persona(persona_id: str, user=Depends(require_user)):
    # 1. Fetch persona to ensure it exists and belongs to current user
    persona = (
        supabase_client()
        .table("personas")
        .select("*")
        .eq("id", persona_id)
        .eq("user_id", user.id)
        .single()
        .execute()
        .data
    )
    if not persona:
        raise HTTPException(404, "Persona not found or unauthorized.")

    # 2. Delete all chat messages for this persona from Supabase
    try:
        supabase_client().table("messages").delete().eq("persona_id", persona_id).eq("user_id", user.id).execute()
    except Exception as e:
        print("[Delete Persona] Error deleting messages from Supabase:", e)

    # 3. Clean up SQLite jobs and local generated job files
    try:
        delete_jobs_for_persona(persona_id, persona.get("photo_path"))
    except Exception as e:
        print("[Delete Persona] Error deleting jobs:", e)

    # 4. Clean up local device files & directory
    user_persona_folder = MEDIA_DIR / "users" / str(user.id) / persona_id
    if user_persona_folder.exists():
        try:
            shutil.rmtree(user_persona_folder, ignore_errors=True)
            print(f"[Delete Persona] Deleted local persona directory: {user_persona_folder}")
        except Exception as e:
            print(f"[Delete Persona] Error deleting folder {user_persona_folder}:", e)

    # Clean up standalone photo or voice files if mapped
    for key in ["photo_path", "voice_path"]:
        raw = persona.get(key)
        if raw:
            resolved = resolve_media_path(raw)
            if resolved and resolved.exists():
                try:
                    resolved.unlink(missing_ok=True)
                    if resolved.parent != MEDIA_DIR and resolved.parent.exists() and not any(resolved.parent.iterdir()):
                        shutil.rmtree(resolved.parent, ignore_errors=True)
                except Exception as e:
                    print(f"[Delete Persona] Error deleting file {resolved}:", e)

    # 5. Delete the persona record from Supabase
    supabase_client().table("personas").delete().eq("id", persona_id).eq("user_id", user.id).execute()

    return {
        "ok": True,
        "message": "Persona, chat history, audio files, and all local assets completely deleted."
    }


@app.post("/api/transcribe")
async def transcribe_voice(
    persona_id: Optional[str] = Form(None),
    audio: UploadFile = File(...),
    language: Optional[str] = Form(None),
    user=Depends(require_user),
):
    """Convert browser-recorded audio to WAV and transcribe it locally with Whisper."""
    persona_lang = None
    if persona_id and not persona_id.startswith("demo-"):
        persona = (
            supabase_client()
            .table("personas")
            .select("language")
            .eq("id", persona_id)
            .eq("user_id", user.id)
            .single()
            .execute()
            .data
        )
        if persona:
            persona_lang = persona.get("language")

    folder = MEDIA_DIR / "users" / str(user.id) / "stt"
    folder.mkdir(parents=True, exist_ok=True)
    uid = uuid.uuid4().hex
    input_path = folder / f"{uid}{Path(audio.filename or '.webm').suffix or '.webm'}"
    wav_path = folder / f"{uid}.wav"
    input_path.write_bytes(await audio.read())

    try:
        ffmpeg = FFMPEG_BIN or "ffmpeg"
        subprocess.run(
            [ffmpeg, "-y", "-i", str(input_path), "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(wav_path)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )

        chosen_lang = (language or "").strip().lower()
        if chosen_lang in {"auto", "detect", "", "none"}:
            whisper_lang = None
        elif chosen_lang in {"hi", "bn", "en"}:
            whisper_lang = chosen_lang
        elif chosen_lang in {"hindi", "bengali", "english"}:
            lang_map = {"hindi": "hi", "bengali": "bn", "english": "en"}
            whisper_lang = lang_map[chosen_lang]
        else:
            whisper_lang = persona_lang or None

        model = get_whisper_model()
        initial_prompt = WHISPER_PROMPTS.get(whisper_lang)
        segments, info = model.transcribe(
            str(wav_path),
            language=whisper_lang,
            initial_prompt=initial_prompt,
            beam_size=5,
            vad_filter=True,
            condition_on_previous_text=False,
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()

        if not text:
            raise HTTPException(400, "I couldn't detect any speech. Please try again.")

        return {
            "text": text,
            "language": info.language,
        }
    except HTTPException:
        raise
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr[-1200:] if exc.stderr else "FFmpeg failed to convert the recording."
        raise HTTPException(500, f"Audio conversion failed: {detail}")
    except Exception as exc:
        print("STT error:", repr(exc))
        raise HTTPException(500, "Voice transcription failed. Please try again.")
    finally:
        input_path.unlink(missing_ok=True)
        wav_path.unlink(missing_ok=True)


@app.post("/api/chat")
def chat(body: ChatRequest, user=Depends(require_user)):
    persona = (
        supabase_client()
        .table("personas")
        .select("*")
        .eq("id", body.persona_id)
        .eq("user_id", user.id)
        .single()
        .execute()
        .data
    )
    if not persona:
        raise HTTPException(404, "Persona not found.")

    history = (
        supabase_client()
        .table("messages")
        .select("role,content")
        .eq("persona_id", body.persona_id)
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .limit(12)
        .execute()
        .data
        or []
    )
    history.reverse()

    supabase_client().table("messages").insert({
        "user_id": user.id,
        "persona_id": body.persona_id,
        "role": "user",
        "content": body.message,
    }).execute()

    target_lang = getattr(body, "language", None)
    try:
        reply = ask_persona(persona, history, body.message, target_language=target_lang)
    except Exception as exc:
        print("[Chat] ask_persona fallback exception:", exc)
        reply = "I'm right here with you! How can I help you today?"

    audio_url = None
    voice_file = resolve_media_path(persona.get("voice_path"))
    if voice_file and voice_file.exists():
        # Auto-detect speech language from reply text for authentic native accent
        has_devanagari = any("\u0900" <= ch <= "\u097F" for ch in reply)
        has_bengali = any("\u0980" <= ch <= "\u09FF" for ch in reply)
        chosen_lang = (getattr(body, "language", None) or "").lower()

        tts_text = reply
        if chosen_lang in {"bn", "bengali"} or has_bengali:
            # Map Bengali Unicode to phonetic Devanagari so XTTS Indian acoustic model pronounces it naturally
            tts_text = "".join(chr(ord(c) - 128) if 0x0980 <= ord(c) <= 0x09FF else c for c in reply)
            tts_lang = "hi"
        elif chosen_lang in {"hi", "hindi"} or has_devanagari:
            tts_lang = "hi"
        else:
            tts_lang = "en"

        try:
            audio = generate_xtts(
                tts_text,
                voice_file,
                tts_lang,
            )
            audio_url = "/media/" + audio.relative_to(MEDIA_DIR).as_posix()
        except Exception as exc:
            print("[XTTS] Voice generation error:", exc)

    try:
        supabase_client().table("messages").insert({
            "user_id": user.id,
            "persona_id": body.persona_id,
            "role": "assistant",
            "content": reply,
        }).execute()
    except Exception as exc:
        print("[Chat] DB insert assistant message error:", exc)

    return {"reply": reply, "audio_url": audio_url}


@app.post("/api/avatar-job")
def avatar_job(
    persona_id: str = Form(...),
    audio_path: str = Form(...),
    user=Depends(require_user),
):
    persona = (
        supabase_client()
        .table("personas")
        .select("*")
        .eq("id", persona_id)
        .eq("user_id", user.id)
        .single()
        .execute()
        .data
    )
    if not persona or not persona.get("photo_path"):
        raise HTTPException(400, "Persona photo is missing.")

    photo_file = resolve_media_path(persona.get("photo_path"))
    if not photo_file or not photo_file.exists():
        raise HTTPException(400, "Persona photo file was not found on server.")

    audio_file = resolve_media_path(audio_path)
    if not audio_file or not audio_file.exists():
        raise HTTPException(400, "Generated audio file was not found.")

    payload = json.dumps({
        "image": str(photo_file),
        "audio": str(audio_file),
    })
    return {"job_id": create_job(payload)}


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")

    result = {
        "id": job["id"],
        "status": job["status"],
        "error": job["error"],
    }
    if job["status"] == "completed" and job["result_path"]:
        result["video_url"] = "/media/" + str(
            Path(job["result_path"]).relative_to(MEDIA_DIR)
        ).replace("\\", "/")
    return result


@app.post("/api/jobs/{job_id}/cancel")
def cancel_video_job(job_id: str, user=Depends(require_user)):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    cancel_job(job_id)
    return {"ok": True, "message": f"Job {job_id} cancelled."}


