"""Dreamers backend — FastAPI app.

Consumer video-generation service (PLAN.md): Google-JWT-authenticated users,
SQL-backed credit system (10 signup credits, 5 per video), Stripe top-ups, and
the vendored dreamers-ai pipeline (Gemini script -> Veo prompts -> chained Veo
3.1 clips -> ffmpeg stitch) behind a one-shot dream API with SSE progress.

Run (from the backend/ directory):
    uvicorn app.main:app --reload
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import credits, dreams, meta, payments, users
from .config import settings
from .db import SessionLocal, init_db
from .errors import install_error_handlers
from .jobs import job_manager
from .services import credit_service
from .services.generation_service import recover_interrupted

API_PREFIX = "/api/v1"


async def _periodic_sweep() -> None:
    """Release orphaned credit holds every SWEEP_INTERVAL_SECONDS (PLAN §7)."""
    while True:
        await asyncio.sleep(settings.SWEEP_INTERVAL_SECONDS)
        db = SessionLocal()
        try:
            released = credit_service.sweep_orphaned_holds(
                db, active_dream_ids=job_manager.active_dream_ids()
            )
            db.commit()
            if released:
                print(f"[sweep] released {released} orphaned credit hold(s)")
        except Exception as exc:  # noqa: BLE001 — sweep must never kill the app
            db.rollback()
            print(f"[sweep] error: {exc}")
        finally:
            db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings.ensure_dirs()
    init_db()

    # E2: jobs stuck from a previous process are failed + refunded on boot.
    db = SessionLocal()
    try:
        recovered = recover_interrupted(db)
        db.commit()
        if recovered:
            print(f"[startup] recovered {recovered} interrupted job(s), holds released")
    finally:
        db.close()

    sweep_task = None
    if settings.SWEEP_INTERVAL_SECONDS > 0:
        sweep_task = asyncio.create_task(_periodic_sweep())
    try:
        yield
    finally:
        if sweep_task is not None:
            sweep_task.cancel()


app = FastAPI(
    title="Dreamers API",
    version="1.0.0",
    description=(
        "Type a dream, get a one-minute cinematic video. Credit-metered "
        "(10 free signup credits, 5 per video, $1 = 1 credit via Stripe)."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

install_error_handlers(app)

app.include_router(meta.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(credits.router, prefix=API_PREFIX)
app.include_router(payments.router, prefix=API_PREFIX)
app.include_router(dreams.router, prefix=API_PREFIX)


@app.get("/", include_in_schema=False)
def index() -> dict:
    return {
        "name": "Dreamers API",
        "docs": "/docs",
        "health": f"{API_PREFIX}/health",
        "config": f"{API_PREFIX}/config",
        "mock": settings.MOCK,
    }
