"""Download a URL (PDF, HTML, text) with retries and a size cap."""
from __future__ import annotations

import time
from dataclasses import dataclass

import httpx

HEADERS = {"User-Agent": "SpaceHeritageExplorer/1.0 (educational RAG project)"}
MAX_BYTES = 150 * 1024 * 1024


@dataclass
class FetchedContent:
    content: bytes
    content_type: str
    final_url: str


def fetch(url: str, retries: int = 3, timeout: float = 90) -> FetchedContent:
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            with httpx.Client(timeout=timeout, headers=HEADERS, follow_redirects=True) as client:
                with client.stream("GET", url) as resp:
                    resp.raise_for_status()
                    buf = bytearray()
                    for part in resp.iter_bytes():
                        buf.extend(part)
                        if len(buf) > MAX_BYTES:
                            raise ValueError(f"{url} exceeds {MAX_BYTES} bytes")
                    return FetchedContent(
                        bytes(buf), resp.headers.get("content-type", ""), str(resp.url)
                    )
        except (httpx.HTTPError, ValueError) as exc:
            last_exc = exc
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Failed to fetch {url}: {last_exc}")
