# PersonaTwin E2E — Complete System Workflow

**PersonaTwin** is an end-to-end multimodal AI platform that creates persistent, conversational **Digital Twins** featuring personality prompting, zero-shot acoustic voice cloning, and audio-driven lip-synced talking avatars.

---

## 1. High-Level Architecture Diagram

```mermaid
flowchart TD
    subgraph Client ["Frontend Layer"]
        F2["Frontend 2 (Vite + React) :3001<br/>Thinking Orbs & Voice Glow"]
        F1["Frontend 1 (Next.js 14) :3000<br/>Classic Dashboard"]
    end

    subgraph Gateway ["FastAPI Gateway (:8001)"]
        AUTH["Supabase Auth & Session Verification"]
        ROUTER["REST API Routes (/api/personas, /api/chat, /api/avatar-job)"]
        MEDIA["Static Media Server (/media)"]
        QUEUE["SQLite Job Queue (data/jobs.sqlite3)"]
    end

    subgraph AI_Engines ["AI & Deep Learning Services"]
        WHISPER["Faster-Whisper (Multilingual STT, CPU/int8)"]
        GEMINI["Google Gemini 2.5 Flash (Conversational LLM)"]
        XTTS["Coqui XTTS v2 Warm Server (:8020, CUDA)"]
        SADTALKER["SadTalker GPU Worker (CUDA, Batch=4, 3DMM)"]
    end

    subgraph Data ["Data & Storage Layer"]
        SUPABASE[("Supabase Cloud DB<br/>(personas, messages tables)")]
        MEDIA_STORE[("Local Disk (/media)<br/>Photos, Audio, Videos & 3D Cache")]
    end

    Client -->|HTTP / FormData| ROUTER
    ROUTER --> AUTH
    AUTH --> SUPABASE
    ROUTER --> WHISPER
    ROUTER --> GEMINI
    ROUTER --> XTTS
    ROUTER --> QUEUE
    QUEUE --> SADTALKER
    XTTS --> MEDIA_STORE
    SADTALKER --> MEDIA_STORE
    MEDIA --> MEDIA_STORE
```

---

## 2. Component & Port Map

| Component | Port | Technology | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend 2 (Modern)** | `http://localhost:3001` | React 18, Vite, Lucide Icons, Thinking Orbs | Real-time chat interface with dynamic thinking orbs, voice waves, and autoplay video cards |
| **Frontend 1 (Classic)** | `http://localhost:3000` | Next.js 14, TailwindCSS | Legacy management dashboard |
| **API Gateway** | `http://127.0.0.1:8001` | FastAPI, Uvicorn, Python 3.10 | Authenticates requests, coordinates LLM/TTS/STT, and manages job queues |
| **XTTS v2 Warm Engine** | `http://127.0.0.1:8020` | Coqui XTTS v2, PyTorch (CUDA) | Keeps acoustic voice cloning model warm in VRAM for instant speech generation (~1.5s) |
| **SadTalker GPU Worker** | Background Worker | Conda (`sadtalker` env, CUDA) | Polls SQLite queue, renders lip-synced face videos with batch processing & 3D face mesh cache |
| **Speech-to-Text (STT)** | Embedded | Faster-Whisper (`small` model) | Transcribes voice inputs for English, Hindi, Bengali, etc. |
| **Cloud Database** | Cloud REST | Supabase (PostgreSQL) | Stores user profiles, persona configs, and historical chats |

---

## 3. Detailed End-to-End Workflows

### Workflow 1: Persona Creation & Identity Enrollment

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Frontend (:3001)
    participant API as FastAPI (:8001)
    participant Supa as Supabase
    participant Disk as Local Media (/media)

    User->>UI: Enters Name, Tone, Style, Humor & Uploads Photo + 5-15s Voice Sample
    UI->>API: POST /api/personas (Multipart Form Data + Bearer JWT)
    API->>API: Validates photo & audio file types
    API->>Disk: Saves photo -> /media/users/{uid}/{pid}/photo.jpg
    API->>Disk: Saves reference voice -> /media/users/{uid}/{pid}/voice.wav
    API->>Supa: Inserts row into 'personas' table
    Supa-->>API: Row saved
    API-->>UI: 200 OK + Persona Object
    UI-->>User: Displays Persona card in library
```

---

### Workflow 2: Text Chat Mode (💬)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Frontend (:3001)
    participant API as FastAPI (:8001)
    participant Gemini as Google Gemini
    participant Supa as Supabase

    User->>UI: Sends text question
    UI->>API: POST /api/chat { persona_id, message, language }
    API->>Supa: Fetches Persona prompt + last 10 chat messages
    API->>API: Assembles system prompt with Persona tone & style
    API->>Gemini: Requests completion (Gemini 2.5 Flash)
    Gemini-->>API: In-character response text
    API->>Supa: Inserts user & assistant messages to 'messages' table
    API-->>UI: Returns { reply: "..." }
    UI-->>User: Displays message bubble
```

---

### Workflow 3: Voice Mode (🎙️ XTTS v2 Zero-Shot Voice Cloning)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Frontend (:3001)
    participant API as FastAPI (:8001)
    participant Whisper as Faster-Whisper STT
    participant Gemini as Google Gemini
    participant XTTS as XTTS v2 Server (:8020)
    participant Disk as Local Media

    alt Voice input provided
        User->>UI: Records audio message
        UI->>API: POST /api/transcribe (Audio blob)
        API->>Whisper: Transcribes speech (with Indic multilingual prompt)
        Whisper-->>API: Returns transcript
        API-->>UI: Sets input text
    end

    User->>UI: Submits query in Voice Tab
    UI->>API: POST /api/chat { persona_id, message, language }
    API->>Gemini: Generates conversational response
    Gemini-->>API: In-character reply text
    API->>XTTS: POST /clone-speech { text, speaker_wav: persona.voice_path, language }
    XTTS-->>Disk: Synthesizes cloned speech -> /media/{uuid}.wav
    API-->>UI: Returns { reply: "...", audio_url: "/media/{uuid}.wav" }
    UI->>UI: Auto-plays voice & animates audio waveform
```

---

### Workflow 4: Video Avatar Mode (🎥 SadTalker 3D Lip-Sync)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Frontend (:3001)
    participant API as FastAPI (:8001)
    participant XTTS as XTTS v2 Server (:8020)
    participant Queue as SQLite jobs.sqlite3
    participant Worker as SadTalker GPU Worker
    participant Disk as Local Storage

    User->>UI: Sends query in Video Tab
    UI->>API: POST /api/chat -> Generates Text (Gemini) + Cloned Audio (XTTS)
    API-->>UI: Returns { reply, audio_url }
    UI->>UI: Displays "Lip-syncing face (SadTalker)..." Thinking Orb
    UI->>API: POST /api/avatar-job { persona_id, audio_path }
    API->>Queue: Enqueues job (status: 'queued', payload: { image, audio })
    API-->>UI: Returns { job_id }

    Worker->>Queue: Fetches job -> Updates status to 'running'
    alt 3D Mesh in Cache?
        Worker->>Worker: Reuses cached coeff.mat & crop.png (0s latency)
    else First Extraction
        Worker->>Worker: Computes 3DMM face geometry -> Caches coeff.mat
    end

    Worker->>Worker: Audio2Coeff (Calculates expression landmarks)
    Worker->>Worker: Fast Batch Face Render (batch_size=4, uint8 direct conversion)
    Worker->>Worker: Merges Video + Audio using FFmpeg
    Worker->>Disk: Saves final video -> /media/sadtalker/{job_id}/{timestamp}.mp4
    Worker->>Queue: Updates job (status: 'completed', result_path)

    loop Polling every 2s
        UI->>API: GET /api/jobs/{job_id}
        API->>Queue: Reads status
        API-->>UI: Returns { status: 'completed', video_url: '/media/...' }
    end

    UI->>UI: Hides Thinking Orb
    UI->>UI: Mounts square 1:1 Video Card in Chat Bubble
    UI-->>User: Video auto-plays with full audio sync and playback controls
```

---

## 4. Performance Optimizations Implemented

1. **Persistent 3D Face Mesh Caching**:
   - The 3D facial landmarks (`coeff.mat`, `crop.png`, `crop_info.pkl`) are cached inside `backend/media/users/.../sadtalker_cache/`. Every subsequent generation reuses the cache, skipping 15–25 seconds of face parsing.
2. **Direct `uint8` Frame Streaming**:
   - Frame arrays are converted directly to 8-bit unsigned integers on the fly (`np.clip(img * 255.0, 0, 255).astype(np.uint8)`), reducing RAM consumption by 75% and preventing out-of-memory errors on long speeches.
3. **Warm GPU Services**:
   - Both XTTS v2 and SadTalker remain loaded in GPU memory to eliminate per-request cold starts.
4. **Zero-Latency Polling**:
   - Status polling operates directly against local SQLite with no remote network bottlenecks.

---

## 5. API Reference Guide

| Endpoint | Method | Headers | Request Body / Query | Description |
| :--- | :--- | :--- | :--- | :--- |
| `/api/personas` | `GET` | `Authorization: Bearer <token>` | None | Returns all personas created by the authenticated user |
| `/api/personas` | `POST` | `Authorization: Bearer <token>` | `multipart/form-data` (`name`, `photo`, `voice_sample`, `tone`, `style`, `humor`, `notes`) | Creates a new persona with enrolled voice & photo |
| `/api/personas/{id}` | `PUT` | `Authorization: Bearer <token>` | `multipart/form-data` (`name`, `tone`, `style`, etc.) | Updates persona details |
| `/api/personas/{id}/messages` | `GET` | `Authorization: Bearer <token>` | None | Retrieves conversation history |
| `/api/transcribe` | `POST` | `Authorization: Bearer <token>` | `multipart/form-data` (`audio`, `language`) | Faster-Whisper audio transcription |
| `/api/chat` | `POST` | `Authorization: Bearer <token>` | JSON (`persona_id`, `message`, `language`) | Generates Gemini reply + XTTS v2 cloned speech audio |
| `/api/avatar-job` | `POST` | `Authorization: Bearer <token>` | `multipart/form-data` (`persona_id`, `audio_path`) | Enqueues a SadTalker video lip-sync job |
| `/api/jobs/{job_id}` | `GET` | None | None | Checks status of a video rendering job |
| `/media/{path}` | `GET` | None | None | Streams static media (audio, video, photos) |

---

## 6. How to Run the Entire System

Open 4 PowerShell terminal tabs in Windows:

### Terminal 1: XTTS v2 Voice Server
```powershell
D:\Anaconda\envs\xtts\python.exe "D:\My Project\PersonaTwin-E2E\backend\app\tts_service.py"
```

### Terminal 2: SadTalker Warm Video Worker
```powershell
cd "D:\My Project\PersonaTwin-E2E\backend"
.\.venv\Scripts\python.exe -m app.worker
```

### Terminal 3: FastAPI Backend
```powershell
cd "D:\My Project\PersonaTwin-E2E\backend"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

### Terminal 4: Frontend Application
```powershell
cd "D:\My Project\PersonaTwin-E2E\frontend"
npm run dev
```

Open your browser at: **`http://localhost:3001`**
