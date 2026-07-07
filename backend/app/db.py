"""SQLAlchemy engine + session plumbing.

SQLite in dev/tests (file-based; worker thread + request threads share it, so
`check_same_thread=False` + a generous busy timeout), PostgreSQL in production
(`pool_pre_ping` keeps long-lived pools healthy). The URL is the only switch.
"""
from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from .config import settings


def _make_engine():
    url = settings.DATABASE_URL
    if url.startswith("sqlite"):
        engine = create_engine(
            url,
            connect_args={"check_same_thread": False, "timeout": 30},
            future=True,
        )

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_conn, _record):
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA busy_timeout=30000")
            cur.close()

        return engine
    return create_engine(url, pool_pre_ping=True, future=True)


engine = _make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def get_db():
    """FastAPI dependency: one session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables (idempotent). Alembic takes over in production later."""
    from .models.base import Base
    from . import models  # noqa: F401  (register every model on Base.metadata)

    Base.metadata.create_all(bind=engine)
