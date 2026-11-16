"""Ingestion pipeline: discover -> fetch -> extract -> chunk -> embed -> store.

Examples:
  python -m app.rag.ingestion --sources ntrs images --query "Apollo 11" --limit 10
  python -m app.rag.ingestion --sources history --query "Skylab" --limit 20
  python -m app.rag.ingestion --url https://www.nasa.gov/history/some-page/
"""
from __future__ import annotations

import argparse
import logging

from app.database.connection import get_connection
from app.rag.chunker import chunk_text, clean_text
from app.rag.document_fetcher import fetch
from app.rag.embeddings import embed_texts
from app.rag.html_extractor import extract_html_text
from app.rag.pdf_extractor import extract_pdf_text
from app.services.nasa_discovery import DiscoveredDocument, discover

log = logging.getLogger("ingestion")
MIN_CHARS = 200


def detect_kind(url: str, content_type: str, data: bytes) -> str:
    ct, path = content_type.lower(), url.lower().split("?")[0]
    if data[:5] == b"%PDF-" or "pdf" in ct or path.endswith(".pdf"):
        return "pdf"
    if "html" in ct or path.endswith((".htm", ".html")):
        return "html"
    if ct.startswith("text/"):
        return "text"
    return "unknown"


def _extract(doc: DiscoveredDocument) -> tuple[str, str]:
    """Return (text, kind)."""
    if doc.inline_text:
        return doc.inline_text, "text"
    fetched = fetch(doc.url)
    kind = detect_kind(fetched.final_url, fetched.content_type, fetched.content)
    if kind == "pdf":
        return extract_pdf_text(fetched.content), kind
    if kind == "html":
        text, _ = extract_html_text(fetched.content)
        return text, kind
    if kind == "text":
        return fetched.content.decode("utf-8", errors="replace"), kind
    return "", kind


def _already_indexed(conn, url: str) -> bool:
    return conn.execute("SELECT 1 FROM space_sources WHERE source_url = %s", (url,)).fetchone() is not None


def ingest_document(conn, doc: DiscoveredDocument) -> str:
    """Returns 'indexed', 'skipped' (already there) or 'empty'."""
    if _already_indexed(conn, doc.url):
        return "skipped"
    text, kind = _extract(doc)
    text = clean_text(text)
    if len(text) < MIN_CHARS:
        return "empty"
    chunks = chunk_text(text)
    vectors = embed_texts(chunks)

    row = conn.execute(
        """INSERT INTO space_sources (title, source_url, document_type, published_date)
           VALUES (%s, %s, %s, %s)
           ON CONFLICT (source_url) DO NOTHING RETURNING id""",
        (doc.title[:500], doc.url, f"{doc.source_name}/{kind}", doc.published_date),
    ).fetchone()
    if row is None:
        return "skipped"
    source_id = row[0]
    with conn.cursor() as cur:
        cur.executemany(
            """INSERT INTO space_documents (source_id, chunk_index, content, embedding)
               VALUES (%s, %s, %s, %s) ON CONFLICT (source_id, chunk_index) DO NOTHING""",
            [(source_id, i, c, v) for i, (c, v) in enumerate(zip(chunks, vectors))],
        )
    return "indexed"


def run_ingestion(sources: list[str], query: str, limit: int = 20, **kwargs) -> dict:
    stats = {"indexed": 0, "skipped": 0, "empty": 0, "failed": 0}
    with get_connection() as conn:
        for doc in discover(sources, query, limit, **kwargs):
            try:
                result = ingest_document(conn, doc)
                conn.commit()  # one document per transaction
            except Exception as exc:
                conn.rollback()
                stats["failed"] += 1
                log.warning("failed %s: %s", doc.url, exc)
                continue
            stats[result] += 1
            log.info("%-8s %s", result, doc.title[:80])
    return stats


def ingest_url(url: str, title: str | None = None) -> str:
    """Ingest any single PDF/HTML/text URL by hand."""
    doc = DiscoveredDocument(title=title or url, url=url, source_name="manual")
    with get_connection() as conn:
        return ingest_document(conn, doc)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    p = argparse.ArgumentParser()
    p.add_argument("--sources", nargs="+", default=["ntrs"], choices=["ntrs", "history", "images"])
    p.add_argument("--query", default="Apollo")
    p.add_argument("--limit", type=int, default=20, help="max documents per source")
    p.add_argument("--url", help="ingest a single URL instead of discovering")
    args = p.parse_args()
    if args.url:
        print(ingest_url(args.url))
    else:
        print(run_ingestion(args.sources, args.query, args.limit))


if __name__ == "__main__":
    main()
