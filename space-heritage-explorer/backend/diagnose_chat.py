import time

from dotenv import load_dotenv

load_dotenv()

from pgvector import Vector

from app.nasa_rag import (
    GEMINI_CHAT_MODEL, RAG_MAX_DISTANCE, _build_prompt, _embed, _generate,
    _group_into_documents, _hybrid_search, _plan_facets, _rerank,
)

Q = "What did Apollo 11 leave on the Moon?"


def timed(label, fn):
    t = time.perf_counter()
    out = fn()
    print(f"{label:<14}{time.perf_counter() - t:6.1f}s")
    return out


print("chat model:", GEMINI_CHAT_MODEL)
vec = Vector(timed("embed query", lambda: _embed(Q, query=True)))
facet = _plan_facets(Q, None)[0]
cands = timed("hybrid search", lambda: _hybrid_search(Q, vec, facet))
cands = [c for c in cands if float(c["distance"]) <= RAG_MAX_DISTANCE]
print("relevant candidates:", len(cands))
ranked = timed("rerank (LLM)", lambda: _rerank(Q, cands))[:6]
print("after rerank:", len(ranked))
docs = _group_into_documents(ranked)
answer = timed("answer (LLM)", lambda: _generate(_build_prompt(Q, docs, [], False)))
print("\nanswer preview:", answer[:300])