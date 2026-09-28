# PersonaTwin E2E setup

## Supabase

1. Create a Supabase project.
2. Enable Email/Password authentication.
3. Run `backend/schema.sql` in SQL Editor.
4. Copy the project URL and anon key into the frontend/backend env files.

## Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env` from `.env.example`.

Use the existing XTTS, SadTalker and FFmpeg installations.

## Frontend

```powershell
cd frontend
npm install
```

Create `frontend/.env.local` from `.env.example`.

## Start

Terminal 1 (Backend API):
```powershell
cd backend
.venv\Scripts\activate
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

Terminal 2 (SadTalker Video Worker):
```powershell
cd backend
.venv\Scripts\activate
python -m app.worker
```

Terminal 3 (Frontend Web App):
```powershell
cd frontend
npm run dev
```

*(Optional) Terminal 4 (Fast Persistent Warm XTTS Server)*:
If not started manually, the backend will auto-warm it in the background on startup:
```powershell
D:\Anaconda\envs\xtts\python.exe backend\xtts_server.py
```

Open http://localhost:3000
