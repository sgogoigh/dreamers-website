"""JWT bridge from the frontend's Auth.js session (PLAN §6).

Auth.js signs a compact HS256 JWT with the shared AUTH_SECRET; every API call
carries it as `Authorization: Bearer <jwt>`. EventSource and <video> tags can't
set headers, so a `?token=` query parameter is accepted as a fallback on those
routes (same verification path).
"""
from __future__ import annotations

from typing import Optional

import jwt
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .errors import AppError
from .models.user import User


def _extract_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer ") and auth[7:].strip():
        return auth[7:].strip()
    return request.query_params.get("token") or None


def decode_token(token: str) -> dict:
    try:
        claims = jwt.decode(token, settings.AUTH_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise AppError(401, "TOKEN_EXPIRED", "Session expired. Please sign in again.")
    except jwt.InvalidTokenError:
        raise AppError(401, "UNAUTHORIZED", "Invalid authentication token.")
    if not claims.get("sub") or not claims.get("email"):
        raise AppError(401, "UNAUTHORIZED", "Token is missing required claims (sub, email).")
    return claims


async def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Verify the JWT and upsert the account (first login grants the signup
    bonus — see auth_service)."""
    token = _extract_token(request)
    if not token:
        raise AppError(401, "UNAUTHORIZED", "Missing bearer token.")
    claims = decode_token(token)

    from .services import auth_service  # local import: avoid module cycle

    return auth_service.upsert_user(db, claims)
