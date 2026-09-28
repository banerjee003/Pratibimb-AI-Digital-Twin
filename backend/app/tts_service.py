import os
import subprocess
import uuid
from pathlib import Path
import requests

from .config import XTTS_PYTHON, MEDIA_DIR, FFMPEG_BIN, ROOT

XTTS_SERVER_URL = os.getenv("XTTS_SERVER_URL", "http://127.0.0.1:8020")
_xtts_server_proc = None


def ensure_xtts_server() -> bool:
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
            env["TTS_HOME"] = os.getenv("TTS_HOME", r"D:\models")
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
    return False


def normalize_reference(src: Path) -> Path:
    # Cache normalized reference by voice file to avoid re-running ffmpeg every time
    norm_path = src.parent / f"{src.stem}_norm.wav"
    if norm_path.exists() and norm_path.stat().st_size > 0:
        return norm_path

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
            "-c:a",
            "pcm_s16le",
            str(norm_path),
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return norm_path


def generate_xtts(text: str, reference: Path, language: str) -> Path:
    if language not in {"en", "hi"}:
        raise RuntimeError("Local XTTS is configured for English/Hindi.")

    # Convert reference audio to clean PCM WAV first (cached)
    ref = normalize_reference(reference)
    out = MEDIA_DIR / f"{uuid.uuid4().hex}.wav"

    # Fast Path: Use persistent warm XTTS server (~1-2 seconds)
    try:
        resp = requests.post(
            f"{XTTS_SERVER_URL}/tts",
            json={
                "text": text[:1500],
                "speaker_wav": str(ref.resolve()),
                "language": language,
                "out_path": str(out.resolve()),
            },
            timeout=90,
        )
        if resp.status_code == 200 and out.exists():
            return out
    except Exception as exc:
        print(f"[XTTS] Warm server request bypassed ({exc}), falling back to direct invocation...")
        ensure_xtts_server()

    # Fallback: direct cold-start subprocess execution
    if not Path(XTTS_PYTHON).exists():
        raise RuntimeError(f"XTTS Python not found: {XTTS_PYTHON}")

    script = """
import os
os.environ["COQUI_TOS_AGREED"] = "1"
os.environ["TTS_HOME"] = os.getenv("TTS_HOME", r"D:\\models")

ffmpeg_dir = os.environ.get("PERSONATWIN_FFMPEG_BIN", "")
if ffmpeg_dir and hasattr(os, "add_dll_directory"):
    try:
        os.add_dll_directory(ffmpeg_dir)
    except Exception:
        pass

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


local_model = r"D:\models\tts\tts_models--multilingual--multi-dataset--xtts_v2"
if os.path.exists(os.path.join(local_model, "model.pth")):
    tts = TTS(
        model_path=local_model,
        config_path=os.path.join(local_model, "config.json"),
    ).to(device)
else:
    tts = TTS(
        "tts_models/multilingual/multi-dataset/xtts_v2"
    ).to(device)

tts.tts_to_file(
    text=TEXT,
    speaker_wav=REF,
    language=LANG,
    file_path=OUT,
    split_sentences=True
)

print("XTTS_DONE")
"""

    script = (
        script
        .replace("TEXT", repr(text[:1500]))
        .replace("REF", repr(str(ref.resolve())))
        .replace("LANG", repr(language))
        .replace("OUT", repr(str(out.resolve())))
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

    return out
