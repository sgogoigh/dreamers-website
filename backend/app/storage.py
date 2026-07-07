"""Artifact storage on disk: data/artifacts/<dream_id>/*.mp4."""
from __future__ import annotations

import shutil
from pathlib import Path

from .config import settings


def _validate_id(dream_id: str) -> bool:
    # ids are 32 hex chars; reject anything else to prevent path traversal.
    return len(dream_id) == 32 and all(c in "0123456789abcdef" for c in dream_id)


def artifacts_dir(dream_id: str, *, create: bool = True) -> Path:
    if not _validate_id(dream_id):
        raise ValueError(f"invalid dream id: {dream_id!r}")
    d = settings.artifacts_dir / dream_id
    if create:
        d.mkdir(parents=True, exist_ok=True)
    return d


def delete_artifacts(dream_id: str) -> None:
    if not _validate_id(dream_id):
        return
    d = settings.artifacts_dir / dream_id
    if d.exists():
        shutil.rmtree(d, ignore_errors=True)
