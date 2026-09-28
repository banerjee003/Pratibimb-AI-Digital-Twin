import os
import subprocess
import sys
from pathlib import Path

from .config import ROOT, SADTALKER_PYTHON, FFMPEG_BIN
from .jobs import init_db

WARM_WORKER_SCRIPT = ROOT / "sadtalker_worker.py"


def main():
    init_db()
    if WARM_WORKER_SCRIPT.exists() and Path(SADTALKER_PYTHON).exists():
        print(f"[Worker] Launching persistent warm SadTalker worker using {SADTALKER_PYTHON}...")
        env = os.environ.copy()
        if FFMPEG_BIN:
            ffmpeg_path = Path(FFMPEG_BIN)
            ffmpeg_dir = ffmpeg_path.parent if ffmpeg_path.is_file() else ffmpeg_path
            env["PERSONATWIN_FFMPEG_BIN"] = str(ffmpeg_dir)
            env["PATH"] = str(ffmpeg_dir) + os.pathsep + env.get("PATH", "")

        while True:
            try:
                proc = subprocess.run(
                    [SADTALKER_PYTHON, str(WARM_WORKER_SCRIPT)],
                    cwd=str(ROOT),
                    env=env,
                )
                if proc.returncode == 0:
                    break
                print(f"[Worker] SadTalker worker exited with code {proc.returncode}. Restarting in 2s...", flush=True)
                import time
                time.sleep(2)
            except KeyboardInterrupt:
                print("[Worker] Worker stopped by user.")
                break
    else:
        print("[Worker] Warm worker script not found, cannot start SadTalker worker.")



if __name__ == "__main__":
    main()
