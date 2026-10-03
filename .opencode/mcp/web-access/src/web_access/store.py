"""Response store: response_id -> full payload, with paging and find_text.

Mirrors pi-web-access's storage semantics (bounded, atomic, session retrieval)
without its disk-cache complexity. SQLite via the stdlib.
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any, Iterable

MAX_ENTRIES = 500
MAX_TEXT = 20_000


def store_dir() -> Path:
    base = os.environ.get("WEB_ACCESS_STORE_DIR") or os.path.join(
        os.environ.get("XDG_CACHE_HOME", os.path.expanduser("~/.cache")), "web-access"
    )
    p = Path(base)
    p.mkdir(parents=True, exist_ok=True)
    return p


_db: sqlite3.Connection | None = None


def _conn() -> sqlite3.Connection:
    global _db
    if _db is None:
        _db = sqlite3.connect(store_dir() / "store.db")
        _db.execute("PRAGMA journal_mode=WAL")
        _db.execute(
            "CREATE TABLE IF NOT EXISTS responses (id TEXT PRIMARY KEY, kind TEXT, created REAL, payload TEXT)"
        )
        _db.commit()
    return _db


def save(kind: str, payload: Any) -> str:
    rid = uuid.uuid4().hex[:16]
    conn = _conn()
    conn.execute(
        "INSERT INTO responses VALUES (?,?,?,?)",
        (rid, kind, time.time(), json.dumps(payload, default=str)),
    )
    conn.execute(
        "DELETE FROM responses WHERE id IN "
        "(SELECT id FROM responses ORDER BY created DESC LIMIT -1 OFFSET ?)",
        (MAX_ENTRIES,),
    )
    conn.commit()
    return rid


def get(response_id: str) -> dict[str, Any] | None:
    row = (
        _conn()
        .execute("SELECT payload FROM responses WHERE id = ?", (response_id,))
        .fetchone()
    )
    if not row:
        return None
    try:
        return json.loads(row[0])
    except json.JSONDecodeError:
        return None


def stats() -> dict[str, Any]:
    conn = _conn()
    count, oldest, newest = conn.execute(
        "SELECT COUNT(*), MIN(created), MAX(created) FROM responses"
    ).fetchone()
    return {
        "responses": count,
        "oldest": oldest,
        "newest": newest,
        "store_dir": str(store_dir()),
    }


def _walk_strings(value: Any, path: str = "") -> Iterable[tuple[str, str]]:
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, dict):
        for k, v in value.items():
            yield from _walk_strings(v, f"{path}.{k}" if path else str(k))
    elif isinstance(value, list):
        for i, v in enumerate(value):
            yield from _walk_strings(v, f"{path}[{i}]")


def find_text(
    payload: Any,
    needles: list[str],
    mode: str = "case-insensitive",
    context: int = 160,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Return bounded matching passages with offsets and hashes."""
    out: list[dict[str, Any]] = []
    for path, text in _walk_strings(payload):
        hay = text if mode == "exact" else text.lower()
        for needle in needles:
            if not needle:
                continue
            target = needle if mode == "exact" else needle.lower()
            start = 0
            while len(out) < limit:
                idx = hay.find(target, start)
                if idx < 0:
                    break
                begin = max(0, idx - context)
                end = min(len(text), idx + len(needle) + context)
                passage = text[begin:end]
                out.append(
                    {
                        "path": path,
                        "offset": idx,
                        "passage": passage[:MAX_TEXT],
                        "sha256": hashlib.sha256(
                            passage.encode("utf-8", "replace")
                        ).hexdigest(),
                    }
                )
                start = idx + max(1, len(needle))
        if len(out) >= limit:
            break
    return out


def page(payload: Any, offset: int, limit: int) -> dict[str, Any]:
    """Page the first long text found in a payload."""
    for path, text in _walk_strings(payload):
        if len(text) > 200:
            chunk = text[offset : offset + limit]
            return {
                "path": path,
                "offset": offset,
                "limit": limit,
                "total": len(text),
                "is_truncated": offset + limit < len(text),
                "next_offset": offset + limit if offset + limit < len(text) else None,
                "content": chunk,
            }
    return {
        "offset": offset,
        "limit": limit,
        "total": 0,
        "is_truncated": False,
        "next_offset": None,
        "content": "",
    }
