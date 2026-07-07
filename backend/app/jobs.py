"""Background generation jobs + live progress fan-out (SSE).

Adapted from dreamers-ai/backend/app/jobs.py: the worker runs the blocking
pipeline in a thread via `asyncio.to_thread`; state persistence happens inside
generation_service (SQL, not JSON files), and this manager only tracks what is
running in-process and fans events out to SSE subscribers.

One active job per DREAM and (enforced at the API layer) one per USER.
There is deliberately no cancel API — business rule B5: generation cannot be
terminated once the prompt is confirmed.
"""
from __future__ import annotations

import asyncio
from typing import Dict, List, Optional

from .services import generation_service


class JobManager:
    def __init__(self) -> None:
        self._subscribers: Dict[str, List[asyncio.Queue]] = {}
        self._running: Dict[str, str] = {}  # dream_id -> user_id
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    # --- SSE subscription -------------------------------------------------
    def subscribe(self, dream_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.setdefault(dream_id, []).append(q)
        return q

    def unsubscribe(self, dream_id: str, q: asyncio.Queue) -> None:
        subs = self._subscribers.get(dream_id)
        if subs and q in subs:
            subs.remove(q)
            if not subs:
                self._subscribers.pop(dream_id, None)

    def _publish(self, dream_id: str, event: dict) -> None:
        for q in self._subscribers.get(dream_id, []):
            q.put_nowait(event)

    # --- introspection ------------------------------------------------------
    def is_running(self, dream_id: str) -> bool:
        return dream_id in self._running

    def user_has_running(self, user_id: str) -> bool:
        return user_id in self._running.values()

    def active_dream_ids(self) -> set[str]:
        return set(self._running.keys())

    def reset(self) -> None:
        """Test hook."""
        self._subscribers.clear()
        self._running.clear()

    # --- lifecycle ----------------------------------------------------------
    async def start(self, dream_id: str, user_id: str) -> None:
        if dream_id in self._running:
            raise RuntimeError("A generation job is already running for this dream.")
        self._loop = asyncio.get_running_loop()
        self._running[dream_id] = user_id
        asyncio.create_task(self._run(dream_id))

    async def _run(self, dream_id: str) -> None:
        def emit(event: dict) -> None:
            # Called from the worker thread → hop onto the event loop.
            if self._loop is not None:
                self._loop.call_soon_threadsafe(self._publish, dream_id, event)

        try:
            await asyncio.to_thread(generation_service.run, dream_id, emit)
        finally:
            self._running.pop(dream_id, None)
            self._publish(dream_id, {"type": "close"})


# Process-wide singleton.
job_manager = JobManager()
