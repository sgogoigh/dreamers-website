from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..errors import AppError
from ..models.payment import Payment
from ..models.user import User
from ..rate_limit import rate_limit
from ..schemas.payment import CheckoutOut, CheckoutRequest, PaymentHistoryOut, PaymentOut
from ..security import get_current_user
from ..services import payment_service

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post(
    "/checkout",
    response_model=CheckoutOut,
    dependencies=[Depends(rate_limit("checkout", *settings.CHECKOUT_RATE_LIMIT))],
)
def create_checkout(
    body: CheckoutRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CheckoutOut:
    payment, url = payment_service.create_checkout(db, user, body.amount_usd)
    db.commit()
    return CheckoutOut(payment_id=payment.id, checkout_url=url)


@router.post("/webhook", include_in_schema=True)
async def webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    """Stripe webhook — signature-verified, NOT JWT-authenticated. The ONLY
    path that credits a purchase (the success redirect is UX-only)."""
    payload = await request.body()
    payment_service.verify_webhook_signature(payload, request.headers.get("Stripe-Signature"))
    try:
        event = json.loads(payload)
    except json.JSONDecodeError:
        raise AppError(400, "INVALID_PAYLOAD", "Webhook payload is not valid JSON.")

    result = payment_service.handle_webhook_event(db, event)
    try:
        db.commit()
    except IntegrityError:
        # Concurrent duplicate delivery lost the idempotency race — the credits
        # were already granted by the winner; ack so Stripe stops retrying.
        db.rollback()
        result = {"handled": True, "reason": "duplicate_delivery"}
    return {"received": True, **result}


@router.get("/history", response_model=PaymentHistoryOut)
def history(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PaymentHistoryOut:
    rows = db.execute(
        select(Payment).where(Payment.user_id == user.id).order_by(Payment.created_at.desc())
    ).scalars().all()
    return PaymentHistoryOut(items=[PaymentOut.model_validate(r) for r in rows])
