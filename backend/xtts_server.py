import json
import os
import re
import subprocess
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

# Configure FFmpeg DLL directory if provided
ffmpeg_bin = os.environ.get("PERSONATWIN_FFMPEG_BIN", "") or r"C:\Users\HP\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin"
ffmpeg_exe = os.environ.get("FFMPEG_BIN", "ffmpeg")
if ffmpeg_bin:
    p = Path(ffmpeg_bin)
    f_dir = str(p.parent if p.is_file() else p)
    os.environ["PATH"] = f_dir + os.pathsep + os.environ.get("PATH", "")
    if hasattr(os, "add_dll_directory") and Path(f_dir).exists():
        try:
            os.add_dll_directory(f_dir)
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

print("[XTTS Server] Initializing PyTorch and loading XTTS v2 model into memory...")
from TTS.api import TTS

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[XTTS Server] Using device: {device}")

local_model_dir = Path(r"D:\models\tts\tts_models--multilingual--multi-dataset--xtts_v2")
if (local_model_dir / "model.pth").exists():
    print(f"[XTTS Server] Loading offline local model directly from {local_model_dir}...")
    tts = TTS(
        model_path=str(local_model_dir),
        config_path=str(local_model_dir / "config.json"),
    ).to(device)
else:
    print("[XTTS Server] Loading model by name...")
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

print("[XTTS Server] XTTS v2 is loaded in memory and warm!")


def clean_text_for_speech(text: str) -> str:
    """Preprocess text for natural, seamless conversational speech synthesis."""
    if not text:
        return ""
    # Remove markdown formatting characters
    cleaned = re.sub(r'[*_~`#>]', '', text)
    # Remove stage directions like (laughs), [giggles], *smiles*
    cleaned = re.sub(r'[\(\[\{][^\)\]\}]*[\)\]\}]', '', cleaned)
    # Remove emoji and non-speech symbols
    cleaned = re.sub(r'[\U00010000-\U0010ffff]', '', cleaned)
    # Convert multiple periods/ellipsis into a single punctuation
    cleaned = re.sub(r'\.{2,}', '. ', cleaned)
    # Normalize multiple punctuation marks
    cleaned = re.sub(r'!+', '!', cleaned)
    cleaned = re.sub(r'\?+', '?', cleaned)
    cleaned = re.sub(r'-{2,}', ', ', cleaned)
    # Clean whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


class XTTSHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ready"}')
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/tts":
            try:
                length = int(self.headers.get("Content-Length", 0))
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                raw_text = payload["text"]
                speaker_wav = payload["speaker_wav"]
                language = payload.get("language", "en")
                out_path = payload["out_path"]

                text = clean_text_for_speech(raw_text)
                if not text:
                    text = "Hello!"

                speed = float(payload.get("speed", os.getenv("TTS_SPEED", "1.08")))
                temperature = float(payload.get("temperature", os.getenv("TTS_TEMPERATURE", "0.35")))
                top_p = float(payload.get("top_p", os.getenv("TTS_TOP_P", "0.85")))
                repetition_penalty = float(payload.get("repetition_penalty", os.getenv("TTS_REPETITION_PENALTY", "2.0")))

                print(f"[XTTS Server] Synthesizing authentic voice audio ({len(text)} chars, temp={temperature}, speed={speed}, top_p={top_p})...")
                tts.tts_to_file(
                    text=text,
                    speaker_wav=speaker_wav,
                    language=language,
                    file_path=out_path,
                    split_sentences=True,
                    speed=speed,
                    temperature=temperature,
                    top_p=top_p,
                    repetition_penalty=repetition_penalty,
                    length_penalty=1.0,
                    enable_text_splitting=False,
                )

                print(f"[XTTS Server] Full audio written to {out_path} ({os.path.getsize(out_path)} bytes)")

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status":"ok"}')
            except Exception as exc:
                print(f"[XTTS Server] Error: {exc}")
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(exc)}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Keep terminal log clean
        pass


def run_server(port=8020):
    server = HTTPServer(("127.0.0.1", port), XTTSHandler)
    print(f"[XTTS Server] Listening on http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[XTTS Server] Shutting down...")
        server.server_close()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8020
    run_server(port)
