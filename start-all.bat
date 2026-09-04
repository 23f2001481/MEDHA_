@echo off
echo Starting Backend and Frontend in separate windows...
start "MEDHA Backend (FastAPI :8000)" cmd /k "cd /d %~dp0backend & python -m uvicorn backend.app:app --reload --port 8000 --app-dir src"
start "MEDHA Frontend (Next.js :3000)" cmd /k "cd /d %~dp0shiksha_sathi & npm run dev"
echo Both servers launched!
