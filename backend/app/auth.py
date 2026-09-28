from fastapi import Header, HTTPException
from supabase import create_client, Client

from .config import (
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
)

_auth_client: Client | None = None
_db_client: Client | None = None


def auth_client() -> Client:
    global _auth_client

    if _auth_client is None:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise RuntimeError("Supabase authentication is not configured.")

        _auth_client = create_client(
            SUPABASE_URL,
            SUPABASE_ANON_KEY,
        )

    return _auth_client


def supabase_client() -> Client:
    global _db_client

    if _db_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError("Supabase service key is not configured.")

        _db_client = create_client(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
        )

    return _db_client


def require_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token.",
        )

    token = authorization.split(" ", 1)[1].strip()

    try:
        user = auth_client().auth.get_user(token).user

        if not user:
            raise ValueError("No user")

        return user

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session.",
        )