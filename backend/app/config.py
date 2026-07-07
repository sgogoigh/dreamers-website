"""Dreamers backend configuration.

Everything is resolved from the environment at import time (backend/.env is
loaded first). The vendored pipeline package (app/pipeline/) imports
`settings.MOCK` and `require_gemini_key` from here — keep both stable.
"""
from __future__ import annotations

import os
import sys
from functools import lru_cache
from pathlib import Path

# Windows consoles default to cp1252 and crash on emoji / em-dashes / model-
# generated Unicode. Force UTF-8 on stdout/stderr for every entry point.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from dotenv import load_dotenv

# app/config.py -> app -> backend
BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")


def _env_bool(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    val = os.getenv(name)
    if val is None or not val.strip():
        return default
    return int(val)


class Settings:
    """Process-wide settings, resolved from env at import time."""

    # --- mode -------------------------------------------------------------
    # In MOCK mode no paid API is called: Gemini/Veo are stubbed with valid,
    # deterministic fixtures (and real ffmpeg-generated placeholder clips).
    MOCK: bool = _env_bool("DREAMERS_MOCK", False)

    # --- data / artifacts ---------------------------------------------------
    DATA_DIR: Path = Path(os.getenv("DREAMERS_DATA_DIR", str(BACKEND_ROOT / "data")))

    # --- database -----------------------------------------------------------
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///" + (BACKEND_ROOT / "data" / "dreamers.db").as_posix(),
    )

    # --- auth ---------------------------------------------------------------
    # Shared with the frontend's Auth.js: it signs the session JWT, we verify it.
    AUTH_SECRET: str = os.getenv("AUTH_SECRET", "dev-secret-change-me")
    JWT_ALGORITHM: str = "HS256"

    # --- keys ---------------------------------------------------------------
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")

    # --- payments -----------------------------------------------------------
    STRIPE_SECRET_KEY: str | None = os.getenv("STRIPE_SECRET_KEY") or None
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    WEBHOOK_TOLERANCE_SECONDS: int = _env_int("WEBHOOK_TOLERANCE_SECONDS", 300)

    # --- pricing (PLAN.md business rules B1-B4) ------------------------------
    SIGNUP_BONUS_CREDITS: int = _env_int("SIGNUP_BONUS_CREDITS", 10)
    CREDITS_PER_VIDEO: int = _env_int("CREDITS_PER_VIDEO", 5)
    USD_PER_CREDIT: int = _env_int("USD_PER_CREDIT", 1)
    MIN_PURCHASE_USD: int = _env_int("MIN_PURCHASE_USD", 5)

    # --- prompt bounds --------------------------------------------------------
    PROMPT_MIN_LEN: int = 3
    PROMPT_MAX_LEN: int = 2000

    # --- trailer shape ---------------------------------------------------------
    # 0 = canonical 8-shot blueprint. Smaller values (>=2) trim the blueprint
    # (keeping the title card) for fast dev/test renders.
    TRAILER_SLOTS: int = _env_int("DREAMERS_TRAILER_SLOTS", 0)

    # --- http -------------------------------------------------------------
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv("DREAMERS_CORS_ORIGINS", "http://localhost:3000").split(",")
        if o.strip()
    ]
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

    # --- ops ----------------------------------------------------------------
    RATE_LIMIT_ENABLED: bool = _env_bool("RATE_LIMIT_ENABLED", True)
    DREAMS_RATE_LIMIT: tuple[int, int] = (5, 60)     # 5 creates / minute / user
    CHECKOUT_RATE_LIMIT: tuple[int, int] = (10, 60)  # 10 checkouts / minute / user
    SWEEP_INTERVAL_SECONDS: int = _env_int("SWEEP_INTERVAL_SECONDS", 900)
    HOLD_ORPHAN_MAX_AGE_SECONDS: int = _env_int("HOLD_ORPHAN_MAX_AGE_SECONDS", 2 * 3600)

    @property
    def artifacts_dir(self) -> Path:
        return self.DATA_DIR / "artifacts"

    @property
    def payments_mock(self) -> bool:
        """Payments run in mock mode when no Stripe key is configured."""
        return self.MOCK or not self.STRIPE_SECRET_KEY

    def ensure_dirs(self) -> None:
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        if self.DATABASE_URL.startswith("sqlite"):
            db_path = self.DATABASE_URL.replace("sqlite:///", "", 1)
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.ensure_dirs()
    return s


settings = get_settings()


def require_gemini_key() -> str:
    """Imported by the vendored pipeline for live Gemini/Veo calls."""
    if not settings.GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY not set. Add it to backend/.env, or run with DREAMERS_MOCK=1."
        )
    return settings.GEMINI_API_KEY
