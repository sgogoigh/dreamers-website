from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    avatar_url: str
    credit_balance: int
    created_at: datetime
    last_login_at: datetime
    dreams_count: int = 0
