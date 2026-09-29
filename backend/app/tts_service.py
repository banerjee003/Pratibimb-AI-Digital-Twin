import os
import subprocess
import uuid
from pathlib import Path
import requests

from .config import XTTS_PYTHON, MEDIA_DIR, FFMPEG_BIN, ROOT

XTTS_SERVER_URL = os.getenv("XTTS_SERVER_URL", "http://127.0.0.1:8020")
_xtts_server_proc = None


def ensure_xtts_server(wait: bool = False, max_wait: int = 15) -> bool:
    """Ensure the persistent warm XTTS server is running in the background."""
    global _xtts_server_proc
    try:
        r = requests.get(f"{XTTS_SERVER_URL}/health", timeout=1)
        if r.status_code == 200:
            return True
    except Exception:
        pass

    server_script = ROOT / "xtts_server.py"
    if not server_script.exists() or not Path(XTTS_PYTHON).exists():
        return False

    if _xtts_server_proc is None or _xtts_server_proc.poll() is not None:
        try:
            env = os.environ.copy()
            env["TTS_HOME"] = os.getenv("TTS_HOME", r"D:\models\tts")
            env["COQUI_TOS_AGREED"] = "1"
            if FFMPEG_BIN:
                ffmpeg_path = Path(FFMPEG_BIN)
                ffmpeg_dir = ffmpeg_path.parent if ffmpeg_path.is_file() else ffmpeg_path
                env["PERSONATWIN_FFMPEG_BIN"] = str(ffmpeg_dir)
                env["PATH"] = str(ffmpeg_dir) + os.pathsep + env.get("PATH", "")

            log_file = open(MEDIA_DIR / "xtts_server.log", "a", encoding="utf-8")
            _xtts_server_proc = subprocess.Popen(
                [XTTS_PYTHON, str(server_script)],
                cwd=str(ROOT),
                env=env,
                stdout=log_file,
                stderr=log_file,
            )
            print("[XTTS] Launched warm XTTS background server (logging to media/xtts_server.log)...")
        except Exception as e:
            print("[XTTS] Could not auto-start XTTS server:", e)
            return False

    if wait:
        import time
        start_t = time.time()
        while time.time() - start_t < max_wait:
            try:
                r = requests.get(f"{XTTS_SERVER_URL}/health", timeout=1)
                if r.status_code == 200:
                    return True
            except Exception:
                pass
            time.sleep(1)
    return False


def normalize_reference(src: Path, force: bool = False) -> Path:
    # Cache normalized reference by voice file, ensuring it is invalidated if src is updated
    norm_path = src.parent / f"{src.stem}_norm.wav"
    if not force and norm_path.exists() and norm_path.stat().st_size > 0:
        try:
            if norm_path.stat().st_mtime >= src.stat().st_mtime:
                return norm_path
        except Exception:
            pass

    ffmpeg = FFMPEG_BIN or "ffmpeg"
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(src),
            "-ac",
            "1",
            "-ar",
            "22050",
            "-af",
            "highpass=f=120,equalizer=f=220:t=q:w=1.0:g=-2.5,equalizer=f=3500:t=q:w=1.0:g=3.0,loudnorm=I=-16:TP=-1.5:LRA=11",
            "-c:a",
            "pcm_s16le",
            str(norm_path),
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return norm_path


def polish_output_audio(audio_path: Path) -> Path:
    """Enhance synthesized speech clarity, pitch accuracy, vocal presence, and eliminate husky muffling."""
    if not audio_path.exists() or audio_path.stat().st_size == 0:
        return audio_path

    ffmpeg = FFMPEG_BIN or "ffmpeg"
    temp_polished = audio_path.parent / f"{audio_path.stem}_p.wav"
    try:
        pitch_scale = float(os.getenv("TTS_PITCH_SCALE", "1.10"))
        pitch_str = f"rubberband=pitch={pitch_scale}," if pitch_scale != 1.0 else ""
        af_chain = (
            f"{pitch_str}"
            "highpass=f=110,"
            "equalizer=f=240:t=q:w=1.2:g=-3.0,"
            "equalizer=f=3500:t=q:w=1.0:g=3.5,"
            "treble=g=2.5:f=6000,"
            "volume=1.05"
        )
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-i",
                str(audio_path),
                "-af",
                af_chain,
                "-c:a",
                "pcm_s16le",
                str(temp_polished),
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if temp_polished.exists() and temp_polished.stat().st_size > 0:
            temp_polished.replace(audio_path)
    except Exception as e:
        print("[Audio Polish] Warning: Could not polish output audio:", e)
        temp_polished.unlink(missing_ok=True)
    return audio_path


def generate_xtts(text: str, reference: Path, language: str) -> Path:
    if language not in {"en", "hi"}:
        raise RuntimeError("Local XTTS is configured for English/Hindi.")

    # Convert reference audio to clean PCM WAV first (cached)
    ref = normalize_reference(reference)
    out = MEDIA_DIR / f"{uuid.uuid4().hex}.wav"

    tts_speed = float(os.getenv("TTS_SPEED", "1.08"))
    tts_temperature = float(os.getenv("TTS_TEMPERATURE", "0.35"))
    tts_top_p = float(os.getenv("TTS_TOP_P", "0.85"))
    tts_repetition_penalty = float(os.getenv("TTS_REPETITION_PENALTY", "2.0"))

    # Fast Path: Use persistent warm XTTS server (~1-2 seconds)
    for attempt in range(4):
        try:
            resp = requests.post(
                f"{XTTS_SERVER_URL}/tts",
                json={
                    "text": text[:1500],
                    "speaker_wav": str(ref.resolve()),
                    "language": language,
                    "out_path": str(out.resolve()),
                    "speed": tts_speed,
                    "temperature": tts_temperature,
                    "top_p": tts_top_p,
                    "repetition_penalty": tts_repetition_penalty,
                },
                timeout=90,
            )
            if resp.status_code == 200 and out.exists():
                return polish_output_audio(out)
        except Exception as exc:
            ensure_xtts_server(wait=True, max_wait=10)
            import time
            time.sleep(1)

    # Fallback: direct cold-start subprocess execution
    if not Path(XTTS_PYTHON).exists():
        raise RuntimeError(f"XTTS Python not found: {XTTS_PYTHON}")

    script = """
import os
import re
os.environ["COQUI_TOS_AGREED"] = "1"
os.environ["TTS_HOME"] = os.getenv("TTS_HOME", r"D:\\models")

ffmpeg_dir = os.environ.get("PERSONATWIN_FFMPEG_BIN", "")
if ffmpeg_dir and hasattr(os, "add_dll_directory"):
    os.add_dll_directory(ffmpeg_dir)

import torch
import soundfile as sf
import torchaudio

def _sf_load(uri, *args, **kwargs):
    data, sr = sf.read(str(uri), dtype="float32")
    t = torch.from_numpy(data)
    if t.ndim == 1:
        t = t.unsqueeze(0)
    elif t.ndim == 2:
        t = t.t()
    return t, sr

torchaudio.load = _sf_load

from TTS.api import TTS

device = "cuda" if torch.cuda.is_available() else "cpu"

local_model = r"D:\\models\\tts\\tts_models--multilingual--multi-dataset--xtts_v2"
if os.path.exists(os.path.join(local_model, "model.pth")):
    tts = TTS(
        model_path=local_model,
        config_path=os.path.join(local_model, "config.json"),
    ).to(device)
else:
    tts = TTS(
        "tts_models/multilingual/multi-dataset/xtts_v2"
    ).to(device)

clean_text = re.sub(r'[*_~`#>]', '', TEXT)
clean_text = re.sub(r'[\(\[\{][^\)\]\}]*[\)\]\}]', '', clean_text)
clean_text = re.sub(r'[\U00010000-\U0010ffff]', '', clean_text)
clean_text = re.sub(r'\\.{2,}', '. ', clean_text)
clean_text = re.sub(r'\\s+', ' ', clean_text).strip() or "Hello!"

tts.tts_to_file(
    text=clean_text,
    speaker_wav=REF,
    language=LANG,
    file_path=OUT,
    split_sentences=True,
    speed=SPEED,
    temperature=TEMP,
    top_p=TOP_P,
    repetition_penalty=REP_PEN,
    length_penalty=1.0,
    enable_text_splitting=False,
)

print("XTTS_DONE")
"""

    script = (
        script
        .replace("TEXT", repr(text[:1500]))
        .replace("REF", repr(str(ref.resolve())))
        .replace("LANG", repr(language))
        .replace("OUT", repr(str(out.resolve())))
        .replace("SPEED", str(tts_speed))
        .replace("TEMP", str(tts_temperature))
        .replace("TOP_P", str(tts_top_p))
        .replace("REP_PEN", str(tts_repetition_penalty))
    )

    env = os.environ.copy()
    env["TTS_HOME"] = os.getenv("TTS_HOME", r"D:\models\tts")
    if FFMPEG_BIN:
        ffmpeg_path = Path(FFMPEG_BIN)
        ffmpeg_dir = ffmpeg_path.parent if ffmpeg_path.is_file() else ffmpeg_path
        env["PERSONATWIN_FFMPEG_BIN"] = str(ffmpeg_dir)
        env["PATH"] = str(ffmpeg_dir) + os.pathsep + env.get("PATH", "")

    proc = subprocess.run(
        [XTTS_PYTHON, "-c", script],
        cwd=str(MEDIA_DIR.parent),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=300,
    )

    if proc.returncode != 0 or not out.exists():
        raise RuntimeError(
            "XTTS failed:\n" + proc.stdout[-6000:]
        )

    return polish_output_audio(out)
