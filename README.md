# PersonaTwin — End-to-End Architecture

This is the production-style version of the working PersonaTwin prototype.

## Architecture

Browser (Next.js)
    ↓ Supabase Auth JWT
FastAPI API
    ├── Gemini → persona response
    ├── XTTS subprocess → local cloned voice
    └── SQLite job queue → SadTalker worker
                                  ↓
                             talking-head MP4

Supabase is used for authentication and cloud metadata. The heavy AI models
remain local on the Windows RTX 3050 machine.

## Reliability design

SadTalker can take around 1–2 minutes on the current RTX 3050. It is not run
inside the normal chat request. Avatar generation is a separate queued job.

The AI model environments are also isolated from the web server:
XTTS is launched with its dedicated Python environment and SadTalker is
launched with its dedicated Python environment.

See SETUP.md for installation and startup commands.
