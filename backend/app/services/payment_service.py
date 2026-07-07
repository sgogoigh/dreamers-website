"""Payments — the ONLY module that talks to Stripe (PLAN §8).

Rules implemented here:
  * amounts: min $5, multiples of $5, 1 credit per $1 (server-validated);
  * crediting happens ONLY via the signed webhook (the success redirect is UX);
  * webhook fulfillment is exactly-once (ledger idempotency on the event id +
    payment status check);
  * with no STRIPE_SECRET_KEY configured, checkout runs in mock mode (fake
    session id + a frontend success URL) so dev/CI needs no Stripe account.
"""
from __future__ import annotations

import hashlib
import hmac
import time
import uuid
from typing import Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..errors import AppError
from ..models.base import utcnow
from ..models.credit import REASON_PURCHASE
from ..models.payment import (
    PAYMENT_EXPIRED,
    PAYMENT_PENDING,
    PAYMENT_SUCCEEDED,
    Payment,
)
from ..models.user import User
from . import credit_service


# ---------------------------------------------------------------------------
# checkout
# ---------------------------------------------------------------------------
def validate_amount(amount_usd: int) -> None:
    if (
        not isinstance(amount_usd, int)
        or amount_usd < settings.MIN_PURCHASE_USD
        or amount_usd % settings.MIN_PURCHASE_USD != 0
    ):
        raise AppError(
            422, "INVALID_AMOUNT",
            f"Amount must be at least ${settings.MIN_PURCHASE_USD} and a multiple of "
            f"${settings.MIN_PURCHASE_USD}.",
            details={"amount_usd": amount_usd},
        )


def create_checkout(db: Session, user: User, amount_usd: int) -> Tuple[Payment, str]:
    """Create a pending payment row + a Stripe Checkout Session; return its URL.
    Caller commits."""
    validate_amount(amount_usd)
    credits = amount_usd * settings.USD_PER_CREDIT

    payment = Payment(
        id=uuid.uuid4().hex,
        user_id=user.id,
        amount_usd=amount_usd,
        credits=credits,
        status=PAYMENT_PENDING,
        stripe_session_id="",  # set below
    )

    if settings.payments_mock:
        session_id = f"cs_mock_{uuid.uuid4().hex}"
        url = f"{settings.FRONTEND_URL}/credits/success?session_id={session_id}"
    else:
        import stripe

        stripe.api_key = settings.STRIPE_SECRET_KEY
        session = stripe.checkout.Session.create(
            mode="payment",
            client_reference_id=user.id,
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "unit_amount": amount_usd * 100,
                    "product_data": {"name": f"{credits} Dreamer Credits"},
                },
                "quantity": 1,
            }],
            metadata={
                "payment_id": payment.id,
                "user_id": user.id,
                "credits": str(credits),
            },
            success_url=f"{settings.FRONTEND_URL}/credits/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.FRONTEND_URL}/credits/cancelled",
        )
        session_id, url = session.id, session.url

    payment.stripe_session_id = session_id
    db.add(payment)
    db.flush()
    return payment, url


# ---------------------------------------------------------------------------
# webhook signature (Stripe's documented t=…,v1=… HMAC-SHA256 scheme)
# ---------------------------------------------------------------------------
def verify_webhook_signature(payload: bytes, sig_header: Optional[str]) -> None:
    secret = settings.STRIPE_WEBHOOK_SECRET
    if not secret:
        raise AppError(400, "WEBHOOK_NOT_CONFIGURED", "Webhook secret is not configured.")
    if not sig_header:
        raise AppError(400, "INVALID_SIGNATURE", "Missing Stripe-Signature header.")

    timestamp: Optional[int] = None
    candidates: list[str] = []
    for part in sig_header.split(","):
        key, _, value = part.strip().partition("=")
        if key == "t":
            try:
                timestamp = int(value)
            except ValueError:
                pass
        elif key == "v1":
            candidates.append(value)

    if timestamp is None or not candidates:
        raise AppError(400, "INVALID_SIGNATURE", "Malformed Stripe-Signature header.")

    signed_payload = f"{timestamp}.".encode() + payload
    expected = hmac.new(secret.encode(), signed_payload, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(expected, c) for c in candidates):
        raise AppError(400, "INVALID_SIGNATURE", "Webhook signature verification failed.")

    if abs(time.time() - timestamp) > settings.WEBHOOK_TOLERANCE_SECONDS:
        raise AppError(400, "STALE_TIMESTAMP", "Webhook timestamp outside tolerance.")


# ---------------------------------------------------------------------------
# fulfillment
# ---------------------------------------------------------------------------
def handle_webhook_event(db: Session, event: dict) -> dict:
    """Process a verified Stripe event. Unknown sessions/types are acked as
    no-ops (returning non-2xx would make Stripe retry forever). Caller commits."""
    etype = event.get("type", "")
    obj = (event.get("data") or {}).get("object") or {}
    session_id = obj.get("id", "")

    payment = db.execute(
        select(Payment).where(Payment.stripe_session_id == session_id)
    ).scalar_one_or_none()

    if payment is None:
        return {"handled": False, "reason": "unknown_session"}

    if etype == "checkout.session.completed":
        if payment.status == PAYMENT_SUCCEEDED:
            return {"handled": True, "reason": "already_fulfilled"}
        payment.status = PAYMENT_SUCCEEDED
        payment.fulfilled_at = utcnow()
        payment.stripe_payment_intent = obj.get("payment_intent")
        credit_service.grant(
            db,
            user_id=payment.user_id,
            delta=payment.credits,
            reason=REASON_PURCHASE,
            reference_type="payment",
            reference_id=payment.id,
            idempotency_key=f"purchase:{event.get('id', payment.id)}",
        )
        return {"handled": True, "reason": "fulfilled"}

    if etype == "checkout.session.expired":
        if payment.status == PAYMENT_PENDING:
            payment.status = PAYMENT_EXPIRED
        return {"handled": True, "reason": "expired"}

    return {"handled": False, "reason": "ignored_event_type"}
