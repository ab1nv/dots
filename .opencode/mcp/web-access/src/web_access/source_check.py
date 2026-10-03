"""source_check: claim -> searched, fetched, passage-level evidence artifact.

Heuristic, honest, and bounded. It never claims more than the passages show:
status is supported | contradicted | unclear | missing-evidence, and every
passage carries exact offsets plus a SHA-256 hash of the matched text.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any

STOPWORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "if",
    "then",
    "than",
    "that",
    "this",
    "these",
    "those",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "of",
    "in",
    "on",
    "at",
    "to",
    "for",
    "with",
    "by",
    "from",
    "as",
    "it",
    "its",
    "into",
    "about",
    "over",
    "under",
    "after",
    "before",
    "between",
    "can",
    "could",
    "should",
    "would",
    "will",
    "does",
    "do",
    "did",
    "has",
    "have",
    "had",
    "not",
    "no",
    "never",
    "only",
    "more",
    "most",
    "less",
    "least",
    "which",
    "who",
    "whom",
    "whose",
    "what",
    "when",
    "where",
    "why",
    "how",
}

NEGATION = re.compile(
    r"\b(not|never|no|false|incorrect|myth|wrong|denies|denied|contradicts?)\b", re.I
)


def keywords(text: str) -> list[str]:
    tokens = re.findall(r"[A-Za-z0-9][A-Za-z0-9._-]{2,}", text.lower())
    seen: list[str] = []
    for token in tokens:
        if token in STOPWORDS or token in seen:
            continue
        seen.append(token)
    return seen[:24]


def paragraphs(content: str) -> list[tuple[int, str]]:
    out: list[tuple[int, str]] = []
    for match in re.finditer(r"[^\n]{80,}", content):
        out.append((match.start(), match.group(0).strip()))
    return out


def score_passage(terms: list[str], passage: str) -> float:
    if not terms:
        return 0.0
    low = passage.lower()
    hits = sum(1 for term in terms if term in low)
    return hits / len(terms)


def check_claim(claim: str, sources: list[dict[str, Any]]) -> dict[str, Any]:
    """sources: [{url, title, content, rank}] -> artifact."""
    terms = keywords(claim)
    exact = claim.strip().lower()
    passages: list[dict[str, Any]] = []
    best = 0.0
    contradicted = False

    for source in sources:
        content = source.get("content") or ""
        if not content:
            continue
        if exact and exact in content.lower():
            idx = content.lower().find(exact)
            passages.append(_passage(source, content, idx, len(claim), 1.0, "exact"))
            best = 1.0
            continue
        scored = sorted(
            (
                (score_passage(terms, text), start, text)
                for start, text in paragraphs(content)
            ),
            key=lambda item: item[0],
            reverse=True,
        )
        for score, start, text in scored[:2]:
            if score <= 0:
                break
            best = max(best, score)
            if NEGATION.search(text) and score >= 0.5:
                contradicted = True
            passages.append(
                _passage(source, content, start, len(text), score, "keyword")
            )

    passages.sort(key=lambda p: p["score"], reverse=True)
    passages = passages[:12]

    if not passages:
        status = "missing-evidence"
    elif contradicted:
        status = "contradicted"
    elif best >= 0.6:
        status = "supported"
    elif best >= 0.3:
        status = "unclear"
    else:
        status = "missing-evidence"

    return {
        "claim": claim,
        "status": status,
        "keywords": terms,
        "sources": [
            {"rank": s.get("rank"), "title": s.get("title"), "url": s.get("url")}
            for s in sources
        ],
        "passages": passages,
        "note": "Heuristic passage matching. Read the passages; do not treat the status as proof.",
    }


def _passage(
    source: dict[str, Any],
    content: str,
    start: int,
    length: int,
    score: float,
    kind: str,
) -> dict[str, Any]:
    end = min(len(content), start + length)
    text = content[start:end]
    return {
        "url": source.get("url"),
        "title": source.get("title"),
        "rank": source.get("rank"),
        "match": kind,
        "score": round(score, 3),
        "offset": start,
        "end": end,
        "sha256": hashlib.sha256(text.encode("utf-8", "replace")).hexdigest(),
        "text": text[:4000],
    }
