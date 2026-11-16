"""Evaluation harness: retrieval quality, citation coverage, accuracy and hallucination rate."""
from __future__ import annotations

import argparse
import json
import logging
import os
import statistics
import time
from pathlib import Path
from typing import Any

try:  # lets `python -m space_eval` read backend/.env before nasa_rag reads its settings
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from psycopg.types.json import Jsonb

from .nasa_rag import _db_connect, answer_question, auth_attempt_limiter, init_database, require_admin
from .space_agents import run_research
from .space_llm import GEMINI_JUDGE_MODEL, llm_json

logger = logging.getLogger("space_eval")
router = APIRouter(prefix="/api/nasa-rag", tags=["Evaluation"])
BENCHMARK_PATH = os.getenv("EVAL_BENCHMARK_PATH", "benchmarks/space_benchmark.json")
_eval_ready = False


def init_eval_tables() -> None:
    global _eval_ready
    if _eval_ready:
        return
    init_database()
    with _db_connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS rag_eval_runs (
                id BIGSERIAL PRIMARY KEY,
                mode TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'running',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                finished_at TIMESTAMPTZ,
                metrics JSONB,
                details JSONB
            )
            """
        )
    _eval_ready = True


# --------------------------------------------------------------------------------------
# LLM judges (temperature 0, JSON output)
# --------------------------------------------------------------------------------------
def judge_facts(question: str, answer: str, facts: list[str]) -> list[dict[str, Any]]:
    data = llm_json(
        f"""You grade an answer against reference facts.
For each reference fact decide: "covered" (answer states it, possibly in other words), "missing", or "contradicted".
Judge only what the ANSWER says. Ignore citation markers.
Return JSON: [{{"fact": "...", "verdict": "covered|missing|contradicted"}}]

QUESTION: {question}
REFERENCE FACTS: {json.dumps(facts)}
ANSWER: {answer}""",
        model=GEMINI_JUDGE_MODEL,
    )
    return data if isinstance(data, list) else []


def judge_faithfulness(answer: str, evidence: dict[Any, str]) -> list[dict[str, Any]]:
    block = "\n\n".join(f"[SOURCE {n}] {text[:1500]}" for n, text in evidence.items())
    data = llm_json(
        f"""You are a strict fact-checker. Split the ANSWER into at most 25 atomic factual claims.
For each claim return:
- "verdict": "supported" if the EVIDENCE supports it, "unsupported" if the evidence does not mention it,
  "contradicted" if the evidence says otherwise.
- "cited_ok": if the claim's sentence carries [SOURCE n] markers, true only when those cited sources themselves
  support the claim; null if it has no markers.
Use ONLY the evidence, not your own knowledge. Skip headings and meta-statements (e.g. "No evidence was found").
Return JSON: [{{"claim": "...", "verdict": "supported|unsupported|contradicted", "cited_ok": true}}]

EVIDENCE:
{block}

ANSWER:
{answer}""",
        model=GEMINI_JUDGE_MODEL,
        max_tokens=4000,
    )
    return data if isinstance(data, list) else []


def judge_declines(question: str, answer: str) -> bool:
    data = llm_json(
        f"""Does the ANSWER decline or say the sources lack the information (true), or does it assert a specific
factual answer to the question (false)?
Return JSON: {{"declines": true}}
QUESTION: {question}
ANSWER: {answer}""",
        model=GEMINI_JUDGE_MODEL, max_tokens=200,
    )
    return bool(data.get("declines")) if isinstance(data, dict) else False


def _safe(fn, default):
    try:
        return fn()
    except Exception:
        logger.exception("Judge call failed")
        return default


# --------------------------------------------------------------------------------------
# Per-item evaluation
# --------------------------------------------------------------------------------------
def evaluate_item(item: dict[str, Any], mode: str, judge: bool) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        result = (run_research(item["question"], include_evidence=True) if mode == "agentic"
                  else answer_question(item["question"], include_evidence=True))
    except Exception as exc:
        logger.exception("Eval item %s failed", item.get("id"))
        return {"id": item.get("id"), "type": item.get("type"), "error": str(exc)[:200]}
    latency = time.perf_counter() - started

    retrieved = result.get("retrieval", {}).get("retrieved", [])
    needles = [n.lower() for n in item.get("expected_sources_any", [])]  # matched against URL or title
    rank = next((i for i, r in enumerate(retrieved, 1)
                 if any(n in r["url"].lower() or n in (r.get("title") or "").lower() for n in needles)), None)
    exp_orgs = set(item.get("expected_organisations", []))
    check = result.get("citation_check", {})
    answer = result.get("answer", "")
    declined = check.get("reason") == "no_relevant_sources" or not check.get("valid", False)

    m: dict[str, Any] = {
        "latency_s": round(latency, 2),
        "retrieval_hit": None if not needles else float(rank is not None),
        "mrr": None if not needles else (1 / rank if rank else 0.0),
        "org_coverage": None if not exp_orgs else len(exp_orgs & {r["organisation"] for r in retrieved}) / len(exp_orgs),
    }
    verdicts: dict[str, Any] = {}
    if item.get("must_refuse"):
        if not declined and judge:
            declined = _safe(lambda: judge_declines(item["question"], answer), False)
        m["refusal_correct"] = float(declined)
    else:
        m["false_refusal"] = float(declined)
        m["valid_citation"] = float(bool(check.get("valid")))
        total = check.get("factual_sentences") or 0
        m["citation_coverage"] = None if not total else round(1 - check.get("uncited_sentences", 0) / total, 3)
        if judge and not declined:
            facts = item.get("reference_facts", [])
            if facts:
                graded = _safe(lambda: judge_facts(item["question"], answer, facts), [])
                covered = sum(1 for g in graded if g.get("verdict") == "covered")
                m["fact_recall"] = covered / len(facts) if graded else None
                m["contradicted_facts"] = sum(1 for g in graded if g.get("verdict") == "contradicted")
                verdicts["facts"] = graded
            claims = _safe(lambda: judge_faithfulness(answer, result.get("evidence", {})), [])
            if claims:
                bad = sum(1 for c in claims if c.get("verdict") in {"unsupported", "contradicted"})
                cited = [c for c in claims if c.get("cited_ok") is not None]
                m.update({
                    "claims_total": len(claims), "claims_unsupported": bad,
                    "hallucination_rate": bad / len(claims),
                    "citation_precision": (sum(1 for c in cited if c["cited_ok"]) / len(cited)) if cited else None,
                })
                verdicts["claims"] = claims
    return {"id": item.get("id"), "type": item.get("type"), "metrics": m, "answer": answer,
            "sources": [s["url"] for s in result.get("sources", [])], "judge": verdicts}


# --------------------------------------------------------------------------------------
# Aggregation, storage, regression detection
# --------------------------------------------------------------------------------------
LOWER_IS_BETTER = {"hallucination_rate", "false_refusal", "latency_s", "claims_unsupported", "contradicted_facts"}
KEYS = ["retrieval_hit", "mrr", "org_coverage", "valid_citation", "citation_coverage", "citation_precision",
        "fact_recall", "hallucination_rate", "refusal_correct", "false_refusal", "latency_s"]


def _mean(values: list[Any]) -> float | None:
    vals = [v for v in values if v is not None]
    return round(statistics.mean(vals), 3) if vals else None


def aggregate(details: list[dict[str, Any]]) -> dict[str, Any]:
    ok = [d for d in details if "metrics" in d]
    metrics: dict[str, Any] = {k: _mean([d["metrics"].get(k) for d in ok]) for k in KEYS}
    total = sum(d["metrics"].get("claims_total", 0) for d in ok)
    bad = sum(d["metrics"].get("claims_unsupported", 0) for d in ok)
    metrics["hallucination_rate_pooled"] = round(bad / total, 3) if total else None
    metrics["items"], metrics["errors"] = len(details), len(details) - len(ok)
    by_type: dict[str, Any] = {}
    for t in sorted({d.get("type") for d in ok if d.get("type")}):
        subset = [d for d in ok if d.get("type") == t]
        by_type[t] = {k: _mean([d["metrics"].get(k) for d in subset])
                      for k in ("retrieval_hit", "fact_recall", "hallucination_rate", "citation_coverage")}
    metrics["by_type"] = by_type
    return metrics


def _regressions(mode: str, run_id: int, metrics: dict[str, Any], tolerance: float = 0.05) -> list[str]:
    with _db_connect() as conn:
        prev = conn.execute(
            "SELECT metrics FROM rag_eval_runs WHERE mode=%s AND status='done' AND id < %s ORDER BY id DESC LIMIT 1",
            (mode, run_id),
        ).fetchone()
    if not prev or not prev["metrics"]:
        return []
    flags = []
    for k in KEYS:
        now, before = metrics.get(k), prev["metrics"].get(k)
        if now is None or before is None or k == "latency_s":
            continue
        worse = (now - before > tolerance) if k in LOWER_IS_BETTER else (before - now > tolerance)
        if worse:
            flags.append(f"{k}: {before} -> {now}")
    return flags


def load_benchmark(path: str | None = None) -> list[dict[str, Any]]:
    return json.loads(Path(path or BENCHMARK_PATH).read_text(encoding="utf-8"))["items"]


def run_benchmark(mode: str = "simple", judge: bool = True, path: str | None = None) -> dict[str, Any]:
    init_eval_tables()
    items = load_benchmark(path)
    out: dict[str, Any] = {}
    for md in (["simple", "agentic"] if mode == "both" else [mode]):
        with _db_connect() as conn:
            run_id = conn.execute("INSERT INTO rag_eval_runs (mode) VALUES (%s) RETURNING id", (md,)).fetchone()["id"]
        details = [evaluate_item(it, md, judge) for it in items]
        metrics = aggregate(details)
        with _db_connect() as conn:
            conn.execute(
                "UPDATE rag_eval_runs SET status='done', finished_at=NOW(), metrics=%s, details=%s WHERE id=%s",
                (Jsonb(metrics), Jsonb(details), run_id),
            )
        out[md] = {"run_id": run_id, "metrics": metrics, "regressions": _regressions(md, run_id, metrics)}
    return out


# --------------------------------------------------------------------------------------
# Routes (admin only: evaluation spends LLM quota)
# --------------------------------------------------------------------------------------
_admin = [Depends(auth_attempt_limiter), Depends(require_admin)]


@router.post("/eval/run", status_code=202, dependencies=_admin)
def eval_run(
    background_tasks: BackgroundTasks,
    mode: str = Query("simple", pattern="^(simple|agentic|both)$"),
    judge: bool = True,
):
    background_tasks.add_task(run_benchmark, mode, judge)
    return {"status": "accepted", "mode": mode, "judge": judge}


@router.get("/eval/runs", dependencies=_admin)
def eval_runs():
    init_eval_tables()
    with _db_connect() as conn:
        return {"runs": conn.execute(
            "SELECT id, mode, status, created_at, finished_at, metrics FROM rag_eval_runs ORDER BY id DESC LIMIT 10"
        ).fetchall()}


@router.get("/eval/runs/{run_id}", dependencies=_admin)
def eval_run_detail(run_id: int):
    init_eval_tables()
    with _db_connect() as conn:
        row = conn.execute("SELECT * FROM rag_eval_runs WHERE id=%s", (run_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Run not found.")
    return row


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="Run the Space RAG benchmark")
    parser.add_argument("--benchmark", default=BENCHMARK_PATH)
    parser.add_argument("--mode", choices=["simple", "agentic", "both"], default="simple")
    parser.add_argument("--no-judge", action="store_true", help="skip LLM judging (retrieval/citation metrics only)")
    args = parser.parse_args()
    print(json.dumps(run_benchmark(args.mode, not args.no_judge, args.benchmark), indent=2, default=str))