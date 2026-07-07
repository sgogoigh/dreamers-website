from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models.credit import CreditLedgerEntry
from ..models.user import User
from ..schemas.credit import BalanceOut, LedgerEntryOut, LedgerPageOut
from ..security import get_current_user
from ..services import credit_service

router = APIRouter(prefix="/credits", tags=["credits"])


@router.get("/balance", response_model=BalanceOut)
def balance(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BalanceOut:
    return BalanceOut(**credit_service.balance_info(db, user.id))


@router.get("/ledger", response_model=LedgerPageOut)
def ledger(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: int = Query(default=0, ge=0),
) -> LedgerPageOut:
    rows = db.execute(
        select(CreditLedgerEntry)
        .where(CreditLedgerEntry.user_id == user.id)
        .order_by(CreditLedgerEntry.id.desc())
        .offset(cursor)
        .limit(limit)
    ).scalars().all()
    next_cursor: Optional[int] = cursor + limit if len(rows) == limit else None
    return LedgerPageOut(
        items=[LedgerEntryOut.model_validate(r) for r in rows],
        next_cursor=next_cursor,
    )
