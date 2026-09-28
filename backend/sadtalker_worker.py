import json
import os
import pickle
import shutil
import sqlite3
import subprocess
import sys
import time
import traceback
import uuid
from pathlib import Path
from time import strftime


# Flush stdout immediately
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)

# Environment paths
ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
MEDIA_DIR = ROOT / "media"
DB_PATH = DATA_DIR / "jobs.sqlite3"

# SadTalker directory
SADTALKER_DIR = Path(r"D:\My Project\SadTalker")
SADTALKER_CHECKPOINTS = SADTALKER_DIR / "checkpoints"
FFMPEG_BIN = r"C:\Users\HP\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe"

# Setup FFmpeg on PATH
if FFMPEG_BIN:
    p = Path(FFMPEG_BIN)
    f_dir = str(p.parent if p.is_file() else p)
    os.environ["PERSONATWIN_FFMPEG_BIN"] = f_dir
    os.environ["PATH"] = f_dir + os.pathsep + os.environ.get("PATH", "")
    if hasattr(os, "add_dll_directory") and Path(f_dir).exists():
        try:
            os.add_dll_directory(f_dir)
        except Exception:
            pass

# IMPORTANT: Set cwd to SADTALKER_DIR so facexlib loads existing gfpgan weights without downloading
os.chdir(str(SADTALKER_DIR))
sys.path.insert(0, str(SADTALKER_DIR))

import torch
from src.utils.init_path import init_path
from src.utils.preprocess import CropAndExtract
from src.test_audio2coeff import Audio2Coeff
from src.facerender.animate import AnimateFromCoeff
from src.generate_batch import get_data
from src.generate_facerender_batch import get_facerender_data
import src.utils.videoio as videoio_mod
import src.facerender.animate as animate_mod

def _safe_save_video_with_watermark(video, audio, save_path, watermark=False):
    save_path = Path(save_path)
    save_path.parent.mkdir(parents=True, exist_ok=True)
    temp_file = save_path.parent / f"temp_{uuid.uuid4().hex}.mp4"

    ffmpeg_exe = FFMPEG_BIN if Path(FFMPEG_BIN).is_file() else "ffmpeg"
    cmd = [
        str(ffmpeg_exe),
        "-y",
        "-hide_banner",
        "-loglevel", "error",
        "-i", str(video),
        "-i", str(audio),
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        str(temp_file),
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0 or not temp_file.exists():
        cmd_fb = [
            str(ffmpeg_exe),
            "-y",
            "-hide_banner",
            "-i", str(video),
            "-i", str(audio),
            "-vcodec", "copy",
            str(temp_file),
        ]
        res_fb = subprocess.run(cmd_fb, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res_fb.returncode != 0 or not temp_file.exists():
            raise RuntimeError(f"FFmpeg audio-video merge failed: {res.stderr}\nFallback: {res_fb.stderr}")

    if watermark is False:
        if save_path.exists():
            try:
                save_path.unlink()
            except Exception:
                pass
        shutil.move(str(temp_file), str(save_path))
    else:
        try:
            import webui
            from modules import paths
            watarmark_path = paths.script_path + "/extensions/SadTalker/docs/sadtalker_logo.png"
        except Exception:
            dir_path = os.path.dirname(os.path.realpath(__file__))
            watarmark_path = dir_path + "/../../docs/sadtalker_logo.png"

        cmd_wm = [
            str(ffmpeg_exe),
            "-y",
            "-hide_banner",
            "-loglevel", "error",
            "-i", str(temp_file),
            "-i", str(watarmark_path),
            "-filter_complex", "[1]scale=100:-1[wm];[0][wm]overlay=(main_w-overlay_w)-10:10",
            str(save_path),
        ]
        subprocess.run(cmd_wm, check=True)
        if temp_file.exists():
            try:
                temp_file.unlink()
            except Exception:
                pass

videoio_mod.save_video_with_watermark = _safe_save_video_with_watermark
animate_mod.save_video_with_watermark = _safe_save_video_with_watermark


device = "cuda" if torch.cuda.is_available() else "cpu"
if device == "cuda":
    torch.backends.cudnn.benchmark = True
print(f"[SadTalker Worker] Loading models into memory on device: {device}...", flush=True)

sadtalker_paths = init_path(
    str(SADTALKER_CHECKPOINTS),
    str(SADTALKER_DIR / "src" / "config"),
    256,
    False,
    "crop",
)

preprocess_model = CropAndExtract(sadtalker_paths, device)
audio_to_coeff = Audio2Coeff(sadtalker_paths, device)
animate_from_coeff = AnimateFromCoeff(sadtalker_paths, device)

print("[SadTalker Worker] Models loaded and warm in GPU memory! Ready for fast inference.", flush=True)


def next_job():
    with sqlite3.connect(DB_PATH) as con:
        row = con.execute(
            "select id,payload from jobs where status='queued' order by rowid limit 1"
        ).fetchone()
        if row:
            con.execute("update jobs set status='running' where id=?", (row[0],))
            con.commit()
        return row


def update_job(job_id, status, result_path=None, error=None):
    with sqlite3.connect(DB_PATH) as con:
        con.execute(
            "update jobs set status=?, result_path=?, error=? where id=?",
            (status, result_path, error, job_id),
        )
        con.commit()


def process_job(job_id, payload):
    t0 = time.time()
    pic_path = payload["image"]
    audio_path = payload["audio"]

    result_dir = MEDIA_DIR / "sadtalker" / job_id
    result_dir.mkdir(parents=True, exist_ok=True)
    temp_dir = result_dir / "tmp"
    temp_dir.mkdir(exist_ok=True)

    # 1. 3DMM Face Extraction with Persistent Caching
    pic_p = Path(pic_path)
    cache_dir = pic_p.parent / "sadtalker_cache"
    coeff_file = cache_dir / "coeff.mat"
    crop_file = cache_dir / "crop.png"
    info_file = cache_dir / "crop_info.pkl"

    if coeff_file.exists() and crop_file.exists() and info_file.exists():
        print(f"[SadTalker Worker] Reusing cached 3D face mesh for {pic_p.name} (0s overhead)", flush=True)
        first_coeff_path = str(coeff_file)
        crop_pic_path = str(crop_file)
        with open(info_file, "rb") as f:
            crop_info = pickle.load(f)
    else:
        cache_dir.mkdir(parents=True, exist_ok=True)
        print(f"[SadTalker Worker] Extracting 3D face mesh for {pic_p.name} (will be cached)...", flush=True)
        raw_coeff, raw_crop, crop_info = preprocess_model.generate(
            pic_path, str(cache_dir), "crop", source_image_flag=True, pic_size=256
        )
        if raw_coeff is None:
            raise RuntimeError("Could not extract face coefficients from image")

        shutil.copyfile(raw_coeff, coeff_file)
        shutil.copyfile(raw_crop, crop_file)
        with open(info_file, "wb") as f:
            pickle.dump(crop_info, f)

        first_coeff_path = str(coeff_file)
        crop_pic_path = str(crop_file)
        print(f"[SadTalker Worker] 3D face mesh cached for {pic_p.name}", flush=True)

    # 2. Audio to Expression (Audio2Coeff)
    batch = get_data(first_coeff_path, audio_path, device, None, still=True)
    coeff_path = audio_to_coeff.generate(batch, str(temp_dir), pose_style=0, ref_pose_coeff_path=None)

    # 3. Fast Batch Face Render (batch_size=4, still mode)
    torch.cuda.empty_cache()
    data = get_facerender_data(
        coeff_path,
        crop_pic_path,
        first_coeff_path,
        audio_path,
        batch_size=4,
        input_yaw_list=None,
        input_pitch_list=None,
        input_roll_list=None,
        expression_scale=1.15,
        still_mode=True,
        preprocess="crop",
        size=256,
    )

    with torch.no_grad():
        result = animate_from_coeff.generate(
            data,
            str(temp_dir),
            pic_path,
            crop_info,
            enhancer=None,
            background_enhancer=None,
            preprocess="crop",
            img_size=256,
        )

    del data
    import gc
    gc.collect()
    torch.cuda.empty_cache()

    final_mp4 = result_dir / f"{strftime('%Y_%m_%d_%H.%M.%S')}.mp4"
    shutil.move(result, final_mp4)
    shutil.rmtree(temp_dir, ignore_errors=True)


    elapsed = time.time() - t0
    print(f"[SadTalker Worker] Job {job_id} complete! Video generated in {round(elapsed, 1)} seconds.", flush=True)
    return final_mp4


def reset_stuck_jobs():
    with sqlite3.connect(DB_PATH) as con:
        cur = con.execute("update jobs set status='queued' where status='running'")
        if cur.rowcount > 0:
            print(f"[SadTalker Worker] Recovered {cur.rowcount} interrupted job(s) back to queue.", flush=True)
        con.commit()


def main():
    reset_stuck_jobs()
    print("[SadTalker Worker] Waiting for avatar jobs in jobs.sqlite3...", flush=True)
    while True:
        job = next_job()
        if not job:
            time.sleep(1)
            continue

        job_id, payload_str = job
        print(f"[SadTalker Worker] Processing job: {job_id}", flush=True)
        try:
            payload = json.loads(payload_str)
            video_path = process_job(job_id, payload)
            update_job(job_id, "completed", str(video_path))
        except Exception as exc:
            traceback.print_exc()
            update_job(job_id, "failed", error=str(exc))


if __name__ == "__main__":
    main()
