"""Sentence-aware chunking with overlap (~450 words ≈ 600 tokens)."""
import re

_SENT = re.compile(r"(?<=[.!?])\s+")


def clean_text(text: str) -> str:
    text = text.replace("\x00", " ")  # Postgres rejects NUL bytes
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_text(text: str, target_words: int = 450, overlap_words: int = 60, min_words: int = 40) -> list[str]:
    flat = clean_text(text).replace("\n", " ")
    units: list[str] = []
    for sentence in (s.strip() for s in _SENT.split(flat)):
        if not sentence:
            continue
        words = sentence.split()
        if len(words) > target_words:  # OCR text with no punctuation
            units += [" ".join(words[i:i + target_words]) for i in range(0, len(words), target_words)]
        else:
            units.append(sentence)

    chunks: list[str] = []
    cur: list[str] = []
    count = 0
    for unit in units:
        n = len(unit.split())
        if cur and count + n > target_words:
            chunks.append(" ".join(cur))
            tail, c = [], 0
            for prev in reversed(cur):
                pn = len(prev.split())
                if c + pn > overlap_words:
                    break
                tail.insert(0, prev)
                c += pn
            cur, count = tail, c
        cur.append(unit)
        count += n

    if cur:
        last = " ".join(cur)
        if len(last.split()) < min_words and chunks:
            chunks[-1] += " " + last
        else:
            chunks.append(last)
    return chunks
