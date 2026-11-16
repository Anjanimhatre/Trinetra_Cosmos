"""Per-user chat history: list/open/delete conversations and a /chat route that saves every exchange.

IMPORTANT: this file defines POST /api/nasa-rag/chat. Delete the old `chat_endpoint` route
at the bottom of nasa_rag.py, otherwise that one answers first and nothing is saved.
"""
from __future__ import annotations

import logging
import threading
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from .auth import get_current_user  # <-- if your auth.py names this dependency differently, change it here
from .nasa_rag import _db_connect, answer_question, chat_limiter, init_database, timed

logger = logging.getLogger("chat_history")
router = APIRouter(prefix="/api/nasa-rag", tags=["Chat history"])

_ready = False
_ready_lock = threading.Lock()


def init_history_tables() -> None:
    global _ready
    if _ready:
        return
    with _ready_lock:
        if _ready:
            return
        init_database()
        with _db_connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS rag_conversations (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS rag_messages (
                    id BIGSERIAL PRIMARY KEY,
                    conversation_id TEXT NOT NULL REFERENCES rag_conversations(id) ON DELETE CASCADE,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    payload JSONB,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS rag_conv_user_idx ON rag_conversations (user_id, updated_at DESC)"
            )
            conn.execute("CREATE INDEX IF NOT EXISTS rag_msg_conv_idx ON rag_messages (conversation_id, id)")
        _ready = True


def _uid(user: Any) -> str:
    """Works whether get_current_user returns a dict, an object or a Pydantic model."""
    if isinstance(user, dict):
        value = user.get("id") or user.get("user_id") or user.get("sub")
    else:
        value = getattr(user, "id", None) or getattr(user, "user_id", None)
    if value is None:
        raise HTTPException(status_code=401, detail="Not signed in.")
    return str(value)


class ChatIn(BaseModel):
    question: str = Field(min_length=2, max_length=1500)
    organisations: list[str] | None = Field(default=None, max_length=5)
    conversation_id: str | None = None


@router.get("/conversations")
def list_conversations(user=Depends(get_current_user)):
    init_history_tables()
    with _db_connect() as conn:
        rows = conn.execute(
            "SELECT id, title, created_at, updated_at FROM rag_conversations "
            "WHERE user_id = %s ORDER BY updated_at DESC LIMIT 100",
            (_uid(user),),
        ).fetchall()
    return rows


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str, user=Depends(get_current_user)):
    init_history_tables()
    with _db_connect() as conn:
        conv = conn.execute(
            "SELECT id, title, created_at, updated_at FROM rag_conversations WHERE id = %s AND user_id = %s",
            (conversation_id, _uid(user)),
        ).fetchone()
        if not conv:
            raise HTTPException(status_code=404, detail="Chat not found.")
        msgs = conn.execute(
            "SELECT id, role, content, payload, created_at FROM rag_messages "
            "WHERE conversation_id = %s ORDER BY id",
            (conversation_id,),
        ).fetchall()
    return {**conv, "messages": msgs}


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str, user=Depends(get_current_user)):
    init_history_tables()
    with _db_connect() as conn:
        conn.execute(
            "DELETE FROM rag_conversations WHERE id = %s AND user_id = %s",
            (conversation_id, _uid(user)),
        )
    return None


@router.post("/chat", dependencies=[Depends(chat_limiter)])
def chat(payload: ChatIn, user=Depends(get_current_user)):
    """Answers the question and saves the exchange. Returns the normal answer plus conversation_id."""
    init_history_tables()
    uid = _uid(user)
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question cannot be empty.")

    conv_id = payload.conversation_id
    with _db_connect() as conn:
        if conv_id:
            owned = conn.execute(
                "SELECT 1 FROM rag_conversations WHERE id = %s AND user_id = %s", (conv_id, uid)
            ).fetchone()
            if not owned:
                raise HTTPException(status_code=404, detail="Chat not found.")
        else:
            conv_id = uuid.uuid4().hex
            conn.execute(
                "INSERT INTO rag_conversations (id, user_id, title) VALUES (%s, %s, %s)",
                (conv_id, uid, question[:80]),
            )

    try:
        with timed("chat_total"):
            result = answer_question(question, payload.organisations)
    except Exception:
        logger.exception("Chat failed")
        raise HTTPException(status_code=503, detail="The assistant is temporarily unavailable.")

    try:
        with _db_connect() as conn:
            conn.execute(
                "INSERT INTO rag_messages (conversation_id, role, content) VALUES (%s, 'user', %s)",
                (conv_id, question),
            )
            conn.execute(
                "INSERT INTO rag_messages (conversation_id, role, content, payload) VALUES (%s, 'assistant', %s, %s)",
                (conv_id, result.get("answer", ""),
                 Jsonb({"sources": result.get("sources", []), "citation_check": result.get("citation_check")})),
            )
            conn.execute("UPDATE rag_conversations SET updated_at = NOW() WHERE id = %s", (conv_id,))
    except Exception:
        logger.exception("Could not save chat history (the answer is still returned)")

    return {**result, "conversation_id": conv_id}