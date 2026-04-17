"""Thin Hive client wrapper. Rejects non-SELECT queries."""

from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Any

from app.schemas.bigdata import HiveQueryResponse

logger = logging.getLogger(__name__)


_SELECT_RE = re.compile(r"^\s*(with\s|select\s)", re.IGNORECASE | re.DOTALL)
_FORBIDDEN_RE = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|merge|load|msck)\b",
    re.IGNORECASE,
)


def _hive_host() -> str:
    return os.environ.get("HIVE_HOST", "hive-server")


def _hive_port() -> int:
    try:
        return int(os.environ.get("HIVE_PORT", "10000"))
    except ValueError:
        return 10000


def _hive_user() -> str:
    return os.environ.get("HIVE_USER", "hive")


def _validate_select(sql: str) -> str:
    stripped = sql.strip().rstrip(";").strip()
    if not stripped:
        raise ValueError("SQL is empty")
    if ";" in stripped:
        raise ValueError("Multiple statements are not allowed")
    if not _SELECT_RE.match(stripped):
        raise ValueError("Only SELECT / WITH queries are allowed")
    if _FORBIDDEN_RE.search(stripped):
        raise ValueError("Only read-only SELECT queries are allowed")
    return stripped


def _run_select_sync(sql: str, limit: int) -> HiveQueryResponse:
    """Synchronous execution via pyhive; wrapped by execute_select."""
    from pyhive import hive  # type: ignore

    conn = hive.Connection(
        host=_hive_host(),
        port=_hive_port(),
        username=_hive_user(),
    )
    try:
        cur = conn.cursor()
        try:
            cur.execute(sql)
            columns = [d[0] for d in (cur.description or [])]
            rows: list[list[Any]] = []
            fetched = 0
            while fetched < limit:
                row = cur.fetchone()
                if row is None:
                    break
                rows.append(list(row))
                fetched += 1
            return HiveQueryResponse(columns=columns, rows=rows)
        finally:
            cur.close()
    finally:
        conn.close()


async def execute_select(sql: str, limit: int = 200) -> HiveQueryResponse:
    """Execute a SELECT query against Hive and return at most `limit` rows."""
    validated = _validate_select(sql)
    logger.info("Hive SELECT limit=%s", limit)
    return await asyncio.to_thread(_run_select_sync, validated, limit)
