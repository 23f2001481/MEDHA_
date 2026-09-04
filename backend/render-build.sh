#!/usr/bin/env bash
# Render build — run with Root Directory = backend
set -euo pipefail
cd "$(dirname "$0")"
unset VIRTUAL_ENV
pip install uv
uv sync --frozen
# DB is already migrated to head via local alembic fix; skip auto-migration
# uv run alembic upgrade head
# uv run python scripts/seed_library.py
