"""Account upsert keyed on Google's stable `sub` claim (PLAN §6).

First login: create the row and grant the signup bonus exactly once (the
ledger idempotency key `signup:<user_id>` makes replays no-ops). Returning
login: refresh profile fields + last_login_at.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..errors import AppError
from ..models.base import utcnow
from ..models.credit import REASON_SIGNUP_BONUS
from ..models.user import User
from . import credit_service


def upsert_user(db: Session, claims: dict) -> User:
    sub = claims["sub"]
    email = claims["email"]
    name = claims.get("name") or ""
    avatar = claims.get("picture") or ""

    user = db.execute(select(User).where(User.google_sub == sub)).scalar_one_or_none()

    if user is None:
        user = User(google_sub=sub, email=email, name=name, avatar_url=avatar)
        try:
            # SAVEPOINT: a concurrent first-login race rolls back only this
            # insert, then we re-read the winner's row.
            with db.begin_nested():
                db.add(user)
                db.flush()
        except IntegrityError:
            user = db.execute(select(User).where(User.google_sub == sub)).scalar_one_or_none()
            if user is None:
                # unique collision was on email, not sub — a different Google
                # account is already registered with this address.
                raise AppError(
                    409, "EMAIL_IN_USE",
                    "This email address is already linked to another account.",
                )
        else:
            credit_service.grant(
                db,
                user_id=user.id,
                delta=settings.SIGNUP_BONUS_CREDITS,
                reason=REASON_SIGNUP_BONUS,
                idempotency_key=f"signup:{user.id}",
            )

    user.name = name or user.name
    user.avatar_url = avatar or user.avatar_url
    user.last_login_at = utcnow()
    db.commit()
    return user
