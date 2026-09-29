import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
MEDIA_DIR = ROOT / "media"
DATA_DIR.mkdir(exist_ok=True)
MEDIA_DIR.mkdir(exist_ok=True)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

XTTS_PYTHON = os.getenv("XTTS_PYTHON", r"D:\Anaconda\envs\xtts\python.exe")
SADTALKER_PYTHON = os.getenv("SADTALKER_PYTHON", r"D:\Anaconda\envs\sadtalker\python.exe")
SADTALKER_DIR = Path(os.getenv("SADTALKER_DIR", "SadTalker"))
SADTALKER_CHECKPOINTS = Path(os.getenv("SADTALKER_CHECKPOINTS", str(SADTALKER_DIR / "checkpoints")))
FFMPEG_BIN = os.getenv("FFMPEG_BIN", "")
