"""Apply Alembic migrations at API startup (optional via env)."""

from __future__ import annotations

import logging
import os
import subprocess
import sys
from pathlib import Path

logger = logging.getLogger(__name__)


def run_migrations_if_enabled() -> None:
    """
    Run `alembic upgrade head` from the backend package root.

    Set RUN_MIGRATIONS_ON_STARTUP=0 (or false/off/no) to skip — e.g. when using
    multiple uvicorn workers (run migrate once via entrypoint or CI instead).
    """
    raw = os.environ.get("RUN_MIGRATIONS_ON_STARTUP", "1").strip().lower()
    if raw in ("0", "false", "no", "off"):
        logger.info("Skipping DB migrations (RUN_MIGRATIONS_ON_STARTUP is disabled).")
        return

    backend_root = Path(__file__).resolve().parent.parent
    logger.info("Applying database migrations (alembic upgrade head)…")
    proc = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(backend_root),
        env=os.environ.copy(),
        capture_output=True,
        text=True,
    )
    if proc.stdout:
        for line in proc.stdout.strip().splitlines():
            logger.info("[alembic] %s", line)
    if proc.stderr:
        for line in proc.stderr.strip().splitlines():
            logger.warning("[alembic] %s", line)
    if proc.returncode != 0:
        logger.error("Alembic exited with code %s", proc.returncode)
        raise RuntimeError("Database migration failed; see logs above.")
    logger.info("Database migrations are up to date.")
