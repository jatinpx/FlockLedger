"""
End-to-end test conftest.

Design
------
* DATABASE_URL is set to a per-process SQLite file in /tmp BEFORE any app
  module is imported so that pydantic-settings picks up the SQLite URL.
* A single shared engine is created once at module level; the SQLite file
  persists for the lifetime of the pytest session (no deletion between tests).
* Each test gets a fresh schema via drop_all / create_all.
* Redis publish calls are monkeypatched to no-ops.
"""

import importlib
import os
import tempfile
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ── 1. Set env vars BEFORE any app import ────────────────────────────────────
_DB_FILE = f"{tempfile.gettempdir()}/flock_e2e_{os.getpid()}_{uuid.uuid4().hex}.sqlite3"
_SQLITE_URL = f"sqlite:///{_DB_FILE}"

os.environ["DATABASE_URL"] = _SQLITE_URL
os.environ["RUN_MIGRATIONS_ON_STARTUP"] = "0"
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6399/15")

# ── 2. Import app modules (they now see the SQLite URL) ───────────────────────
import app.models  # noqa: F401  – registers all ORM mappers
import app.database as _db_module  # noqa: E402
from app.main import app  # noqa: E402
from app.database import Base, get_db  # noqa: E402

# ── 3. Create a dedicated test engine and override the module-level objects ───
#    This handles the edge case where the Settings singleton was already built
#    with the postgres URL before conftest ran (e.g., via a cached import).
_test_engine = create_engine(_SQLITE_URL, connect_args={"check_same_thread": False})
_TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)

_db_module.engine = _test_engine
_db_module.SessionLocal = _TestSessionLocal


def _override_get_db():
    db = _TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db

PUBLISH_ROUTE_MODULES = (
    "app.api.routes.expenses",
    "app.api.routes.farms",
    "app.api.routes.feed",
    "app.api.routes.flock",
    "app.api.routes.labour",
    "app.api.routes.production",
    "app.api.routes.sales",
)


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch):
    # Silence Redis publish calls – Redis is not available in test env.
    for module_name in PUBLISH_ROUTE_MODULES:
        module = importlib.import_module(module_name)
        monkeypatch.setattr(module, "publish_farm_event", lambda *args, **kwargs: None)

    # Fresh schema for each test.
    Base.metadata.drop_all(bind=_test_engine)
    Base.metadata.create_all(bind=_test_engine)
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        Base.metadata.drop_all(bind=_test_engine)
