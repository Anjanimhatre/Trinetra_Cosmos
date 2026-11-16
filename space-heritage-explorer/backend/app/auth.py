"""Accounts + per-user chat storage for the Space Heritage RAG API.

- Register / sign in with Google (ID token verified server-side), plus a password for email login.
- Two roles: 'user' and 'admin'. Admin is granted only to emails listed in ADMIN_EMAILS.
- Every conversation belongs to exactly one user; all queries filter by user_id.

Install: pip install PyJWT google-auth requests "psycopg[binary]" pydantic fastapi
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import jwt
import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from psycopg.rows import dict_row
from psycopg.types.json import Json
from pydantic import BaseModel, Field

logger = logging.getLogger("space_rag.auth")
router = APIRouter(prefix="/api/auth", tags=["Auth"])

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("NEON_DATABASE_URL") or os.getenv("NEON_POSTGRES_URL")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", str(60 * 24 * 7)))  # 7 days
ADMIN_EMAILS = {e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()}
TRUST_PROXY = os.getenv("TRUST_PROXY", "false").lower() == "true"


# --------------------------------------------------------------------------------------
# Database
# --------------------------------------------------------------------------------------
def _db():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is missing.")
    return psycopg.connect(DATABASE_URL, connect_timeout=15, autocommit=True, row_factory=dict_row)


def init_auth_tables() -> None:
    with _db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS app_users (
                id BIGSERIAL PRIMARY KEY,
                google_sub TEXT UNIQUE,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT,
                role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_conversations (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS chat_conversations_user_idx "
            "ON chat_conversations (user_id, updated_at DESC)"
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                id BIGSERIAL PRIMARY KEY,
                conversation_id BIGINT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                sources JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS chat_messages_conv_idx ON chat_messages (conversation_id, id)"
        )


# --------------------------------------------------------------------------------------
# Passwords (scrypt, standard library only)
# --------------------------------------------------------------------------------------
def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(digest).decode()


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        _, salt_b64, digest_b64 = stored.split("$")
        salt, expected = base64.b64decode(salt_b64), base64.b64decode(digest_b64)
        actual = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


# --------------------------------------------------------------------------------------
# Rate limiting for auth endpoints (in-memory, per IP)
# --------------------------------------------------------------------------------------
_hits: dict[str, deque] = defaultdict(deque)
_hits_lock = threading.Lock()


def _client_ip(request: Request) -> str:
    if TRUST_PROXY:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def auth_limiter(request: Request) -> None:
    limit, window = 10, 60
    key = _client_ip(request)
    now = time.monotonic()
    with _hits_lock:
        q = _hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(429, "Too many attempts. Please try again later.",
                                headers={"Retry-After": str(int(window - (now - q[0])) + 1)})
        q.append(now)


# --------------------------------------------------------------------------------------
# Tokens + Google verification
# --------------------------------------------------------------------------------------
def _secret() -> str:
    if len(JWT_SECRET) < 32:
        raise HTTPException(503, "Server auth is not configured (JWT_SECRET must be 32+ characters).")
    return JWT_SECRET


def _issue_token(user: dict[str, Any]) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user["id"]), "role": user["role"], "iat": now,
               "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES)}
    return jwt.encode(payload, _secret(), algorithm="HS256")


def _verify_google(credential: str) -> dict[str, Any]:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Google sign-in is not configured (GOOGLE_CLIENT_ID).")
    try:
        info = google_id_token.verify_oauth2_token(credential, google_requests.Request(), GOOGLE_CLIENT_ID)
    except ValueError:
        raise HTTPException(401, "Invalid Google credential.")
    if not info.get("email") or not info.get("email_verified"):
        raise HTTPException(401, "Google account email is not verified.")
    return info


def _public_user(row: dict[str, Any]) -> dict[str, Any]:
    return {"id": row["id"], "name": row["name"], "email": row["email"], "role": row["role"]}


def _auth_response(row: dict[str, Any]) -> dict[str, Any]:
    return {"access_token": _issue_token(row), "token_type": "bearer", "user": _public_user(row)}


# --------------------------------------------------------------------------------------
# Dependencies
# --------------------------------------------------------------------------------------
def get_current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Sign in required.", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(authorization[7:].strip(), _secret(), algorithms=["HS256"])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Invalid or expired session.", headers={"WWW-Authenticate": "Bearer"})
    with _db() as conn:
        row = conn.execute("SELECT id, name, email, role FROM app_users WHERE id = %s", (user_id,)).fetchone()
    if not row:
        raise HTTPException(401, "Account no longer exists.")
    return row  # role is read fresh from the database, never trusted from the token


def require_admin_user(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if user["role"] != "admin":
        raise HTTPException(403, "Admin access required.")
    return user


# --------------------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    credential: str = Field(min_length=20, max_length=4096)           # Google ID token
    password: str = Field(min_length=8, max_length=128)
    user_type: Literal["admin", "user"] = "user"


class GoogleLoginRequest(BaseModel):
    credential: str = Field(min_length=20, max_length=4096)


class PasswordLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


@router.post("/register", status_code=201, dependencies=[Depends(auth_limiter)])
def register(payload: RegisterRequest):
    info = _verify_google(payload.credential)
    email = info["email"].lower()
    name = (info.get("name") or email.split("@")[0]).strip()[:120]  # name + email come from Google, not the client

    if payload.user_type == "admin" and email not in ADMIN_EMAILS:
        raise HTTPException(403, "This account is not allowed to register as an admin.")

    try:
        with _db() as conn:
            row = conn.execute(
                "INSERT INTO app_users (google_sub, name, email, password_hash, role) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id, name, email, role",
                (info["sub"], name, email, hash_password(payload.password), payload.user_type),
            ).fetchone()
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "An account with this Google account or email already exists. Please sign in.")
    return _auth_response(row)


@router.post("/google", dependencies=[Depends(auth_limiter)])
def google_login(payload: GoogleLoginRequest):
    info = _verify_google(payload.credential)
    with _db() as conn:
        row = conn.execute(
            "SELECT id, name, email, role FROM app_users WHERE google_sub = %s OR email = %s",
            (info["sub"], info["email"].lower()),
        ).fetchone()
    if not row:
        raise HTTPException(404, "No account found. Please register first.")
    return _auth_response(row)


@router.post("/login", dependencies=[Depends(auth_limiter)])
def password_login(payload: PasswordLoginRequest):
    with _db() as conn:
        row = conn.execute(
            "SELECT id, name, email, role, password_hash FROM app_users WHERE email = %s",
            (payload.email.strip().lower(),),
        ).fetchone()
    if not row or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(401, "Invalid email or password.")
    return _auth_response(row)


@router.get("/me")
def me(user: dict[str, Any] = Depends(get_current_user)):
    return _public_user(user)


@router.get("/users")
def list_users(_: dict[str, Any] = Depends(require_admin_user)):
    """Admin only: account list (no passwords, no chat content)."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT id, name, email, role, created_at FROM app_users ORDER BY id DESC LIMIT 500"
        ).fetchall()
    return {"users": rows}


# --------------------------------------------------------------------------------------
# Per-user chat storage. Every function takes user_id, so one user can never read another's chats.
# --------------------------------------------------------------------------------------
def create_conversation(user_id: int, title: str) -> int:
    with _db() as conn:
        row = conn.execute(
            "INSERT INTO chat_conversations (user_id, title) VALUES (%s, %s) RETURNING id",
            (user_id, title.strip()[:80] or "New chat"),
        ).fetchone()
    return row["id"]


def conversation_belongs_to(conversation_id: int, user_id: int) -> bool:
    with _db() as conn:
        return bool(conn.execute(
            "SELECT 1 FROM chat_conversations WHERE id = %s AND user_id = %s", (conversation_id, user_id)
        ).fetchone())


def add_message(conversation_id: int, role: str, content: str, sources: list | None = None) -> None:
    with _db() as conn:
        conn.execute(
            "INSERT INTO chat_messages (conversation_id, role, content, sources) VALUES (%s, %s, %s, %s)",
            (conversation_id, role, content, Json(sources) if sources is not None else None),
        )
        conn.execute("UPDATE chat_conversations SET updated_at = NOW() WHERE id = %s", (conversation_id,))


def list_conversations(user_id: int) -> list[dict[str, Any]]:
    with _db() as conn:
        return conn.execute(
            "SELECT id, title, created_at, updated_at FROM chat_conversations "
            "WHERE user_id = %s ORDER BY updated_at DESC LIMIT 100",
            (user_id,),
        ).fetchall()


def get_conversation(conversation_id: int, user_id: int) -> dict[str, Any] | None:
    with _db() as conn:
        conv = conn.execute(
            "SELECT id, title, created_at, updated_at FROM chat_conversations WHERE id = %s AND user_id = %s",
            (conversation_id, user_id),
        ).fetchone()
        if not conv:
            return None
        conv["messages"] = conn.execute(
            "SELECT id, role, content, sources, created_at FROM chat_messages "
            "WHERE conversation_id = %s ORDER BY id",
            (conversation_id,),
        ).fetchall()
    return conv


def delete_conversation(conversation_id: int, user_id: int) -> bool:
    with _db() as conn:
        row = conn.execute(
            "DELETE FROM chat_conversations WHERE id = %s AND user_id = %s RETURNING id",
            (conversation_id, user_id),
        ).fetchone()
    return bool(row)