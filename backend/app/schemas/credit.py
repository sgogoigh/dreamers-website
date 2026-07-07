from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class BalanceOut(BaseModel):
    balance: int
    held: int
    videos_remaining: int
    credits_per_video: int


class LedgerEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    delta: int
    reason: str
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    balance_after: int
    created_at: datetime


class LedgerPageOut(BaseModel):
    items: List[LedgerEntryOut]
    next_cursor: Optional[int] = None
