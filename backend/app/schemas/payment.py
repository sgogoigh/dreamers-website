from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class CheckoutRequest(BaseModel):
    amount_usd: int = Field(description="USD amount; min $5, multiples of $5")


class CheckoutOut(BaseModel):
    payment_id: str
    checkout_url: str


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    amount_usd: int
    credits: int
    status: str
    created_at: datetime
    fulfilled_at: Optional[datetime] = None


class PaymentHistoryOut(BaseModel):
    items: List[PaymentOut]
