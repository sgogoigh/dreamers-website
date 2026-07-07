from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models.dream import Dream
from ..models.user import User
from ..schemas.user import UserOut
from ..security import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserOut:
    dreams_count = db.execute(
        select(func.count(Dream.id)).where(Dream.user_id == user.id)
    ).scalar_one()
    out = UserOut.model_validate(user)
    out.dreams_count = dreams_count
    return out
