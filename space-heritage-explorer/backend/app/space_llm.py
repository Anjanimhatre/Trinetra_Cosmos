"""Gemini helpers shared by the graph, agent and evaluation modules.
All calls go through gemini_generate (retry, backoff, model fallback, thinking budget)."""
from __future__ import annotations

import json
import os
import re
from typing import Any

from .nasa_rag import GEMINI_CHAT_MODEL, gemini_generate

# Use a different (ideally stronger) model than the generator for judging, to reduce self-preference bias.
GEMINI_JUDGE_MODEL = os.getenv("GEMINI_JUDGE_MODEL", GEMINI_CHAT_MODEL)


def llm_text(prompt: str, *, model: str | None = None, max_tokens: int = 2500, temperature: float = 0.2) -> str:
    r = gemini_generate(prompt, model=model, temperature=temperature, max_output_tokens=max_tokens)
    return (r.text or "").strip()


def llm_json(prompt: str, *, model: str | None = None, max_tokens: int = 3000) -> Any:
    """Deterministic JSON call. Raises on invalid JSON; callers decide how to degrade."""
    r = gemini_generate(
        prompt, model=model, temperature=0.0, max_output_tokens=max_tokens,
        response_mime_type="application/json",
    )
    text = re.sub(r"^```(?:json)?|```$", "", (r.text or "").strip(), flags=re.M).strip()
    return json.loads(text)