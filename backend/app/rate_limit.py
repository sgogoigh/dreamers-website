"""Minimal in-memory per-user rate limiting (PLAN §15).

Fixed sliding window per (route, user). In-process only — sufficient for the
single-instance v1 deploy; swap for Redis when scaling out.
"""
from __future__ import annotations

import threading
import time
from collections import deque
from typing import Dict

from fastapi import Depends

from .config import settings
from .errors import AppError
from .models.user import User
from .security import get_current_user

_BUCKETS: Dict[str, deque] = {}
_LOCK = threading.Lock()


def reset() -> None:
    """Test hook."""
    with _LOCK:
        _BUCKETS.clear()


def rate_limit(name: str, max_calls: int, window_seconds: int):
    """Dependency factory. Counts every attempt (including ones that later
    fail validation) so a hot loop can't hammer the handler."""

    async def dependency(user: User = Depends(get_current_user)) -> None:
        if not settings.RATE_LIMIT_ENABLED:
            return
        key = f"{name}:{user.id}"
        now = time.monotonic()
        with _LOCK:
            bucket = _BUCKETS.setdefault(key, deque())
            while bucket and bucket[0] <= now - window_seconds:
                bucket.popleft()
            if len(bucket) >= max_calls:
                raise AppError(
                    429, "RATE_LIMITED",
                    f"Too many requests — limit is {max_calls} per {window_seconds}s.",
                    details={"retry_after_seconds": int(bucket[0] + window_seconds - now) + 1},
                )
            bucket.append(now)

    return dependency
