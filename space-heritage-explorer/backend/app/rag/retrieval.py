"""Vector similarity search over stored chunks (cosine distance)."""
from app.database.connection import get_connection
from app.rag.embeddings import embed_query

SQL = """
SELECT d.content, d.chunk_index, s.title, s.source_url, s.document_type,
       1 - (d.embedding <=> %s) AS score
FROM space_documents d
JOIN space_sources s ON s.id = d.source_id
ORDER BY d.embedding <=> %s
LIMIT %s
"""


def search(query: str, k: int = 5) -> list[dict]:
    vec = embed_query(query)
    with get_connection() as conn:
        rows = conn.execute(SQL, (vec, vec, k)).fetchall()
    return [
        {"content": r[0], "chunk_index": r[1], "title": r[2],
         "source_url": r[3], "document_type": r[4], "score": float(r[5])}
        for r in rows
    ]
