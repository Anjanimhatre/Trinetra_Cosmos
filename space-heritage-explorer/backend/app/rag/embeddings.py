"""all-MiniLM-L6-v2 embeddings (384 dims, normalised for cosine search)."""
import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def embed_texts(texts: list[str], batch_size: int = 32) -> np.ndarray:
    return get_model().encode(
        texts, batch_size=batch_size, normalize_embeddings=True, show_progress_bar=False
    )


def embed_query(query: str) -> np.ndarray:
    return embed_texts([query])[0]
