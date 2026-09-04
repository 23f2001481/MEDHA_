@echo off
title MEDHA Backend (FastAPI :8000)
cd /d "%~dp0backend"
echo Starting MEDHA FastAPI Backend on port 8000...
python -m uvicorn backend.app:app --reload --port 8000 --app-dir src
pause
