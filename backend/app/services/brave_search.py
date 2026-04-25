"""Brave Web Search integration exposed as an AI assistant tool.

The tool accepts a *list* of queries and runs them in parallel so one
tool round-trip can cover several angles of the user's question. The
API key is read from the ``BRAVE_API_KEY`` environment variable; results
are biased toward Simplified Chinese (``search_lang=zh-hans``,
``country=CN``, ``ui_lang=zh-CN``) but the prompt / schema text is kept
in English so the LLM's tool-use formatting stays consistent.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, List

import httpx

logger = logging.getLogger(__name__)

BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search"
DEFAULT_RESULT_COUNT = 5
MAX_QUERIES_PER_CALL = 5
REQUEST_TIMEOUT = 12.0
# Brave's free tier caps at ~1 request/second from the same subscription
# key. Fire queries serially with a small gap so a batch of N keywords
# doesn't lose results to 429s — paid tiers tolerate the delay fine.
REQUEST_GAP_SECONDS = 1.05
# Extra wait before retrying a single query that hit a 429.
RETRY_BACKOFF_SECONDS = 2.0


def get_api_key() -> str:
    """Return the configured key, or empty string if none/placeholder."""
    raw = (os.getenv("BRAVE_API_KEY") or "").strip()
    if not raw or raw.lower().startswith("your_"):
        return ""
    return raw


def is_available() -> bool:
    return bool(get_api_key())


def _pick(item: Dict[str, Any]) -> Dict[str, Any]:
    """Project a raw Brave result entry into the minimal shape we return."""
    meta = item.get("meta_url") or {}
    return {
        "title": (item.get("title") or "").strip(),
        "url": (item.get("url") or "").strip(),
        "description": (item.get("description") or "").strip(),
        "age": (item.get("age") or "").strip(),
        "favicon": (meta.get("favicon") or "").strip(),
        "hostname": (meta.get("hostname") or "").strip(),
    }


async def _brave_search_one(
    client: httpx.AsyncClient, query: str, *, count: int
) -> List[Dict[str, Any]]:
    """Issue a single Brave query. Returns [] on any failure.

    Retries once on HTTP 429 after a short sleep, which is usually
    enough to escape the 1-req/sec free-tier window.
    """
    api_key = get_api_key()
    if not api_key or not query:
        return []

    params = {
        "q": query,
        "count": max(1, min(count, 10)),
        "search_lang": "zh-hans",
        "country": "CN",
        "ui_lang": "zh-CN",
        "safesearch": "moderate",
        "text_decorations": "false",
        "spellcheck": "true",
    }
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": api_key,
    }

    resp: httpx.Response | None = None
    for attempt in range(2):
        try:
            resp = await client.get(
                BRAVE_API_URL,
                headers=headers,
                params=params,
                timeout=REQUEST_TIMEOUT,
            )
        except httpx.HTTPError as e:
            logger.warning("brave_search network error for %r: %s", query, e)
            return []

        if resp.status_code == 429 and attempt == 0:
            logger.info(
                "brave_search rate-limited for %r, retrying in %.1fs",
                query,
                RETRY_BACKOFF_SECONDS,
            )
            await asyncio.sleep(RETRY_BACKOFF_SECONDS)
            continue
        break

    if resp is None or resp.status_code != 200:
        status = resp.status_code if resp is not None else "n/a"
        body = resp.text[:200] if resp is not None else ""
        logger.warning("brave_search non-200 for %r: %s %s", query, status, body)
        return []

    try:
        data = resp.json()
    except ValueError:
        logger.warning("brave_search invalid JSON for %r", query)
        return []

    raw_items = (data.get("web") or {}).get("results") or []
    out: List[Dict[str, Any]] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        picked = _pick(item)
        if picked["url"] and picked["title"]:
            out.append(picked)
    return out


def _normalize_queries(raw: Any) -> List[str]:
    """Coerce the tool's ``queries`` argument into a clean list of strings."""
    if isinstance(raw, str):
        items = [raw]
    elif isinstance(raw, list):
        items = raw
    else:
        return []
    seen: set = set()
    out: List[str] = []
    for q in items:
        s = str(q or "").strip()
        if not s or s in seen:
            continue
        seen.add(s)
        out.append(s)
        if len(out) >= MAX_QUERIES_PER_CALL:
            break
    return out


async def brave_search_many(
    queries: List[str], *, count: int = DEFAULT_RESULT_COUNT
) -> List[Dict[str, Any]]:
    """Run ``queries`` serially (spaced for rate-limit compliance) and
    return one group per query, in order.

    Each group is ``{"query": str, "results": [...]}`` — queries that
    fail (rate-limited, timeout, etc.) still appear in the output with
    an empty ``results`` list so the caller (and the model) can see
    which ones came back empty.

    Note: an earlier implementation fired all queries concurrently via
    ``asyncio.gather``. Brave's free tier caps at ~1 req/sec per key,
    so with 3 concurrent calls two would come back 429 and the user
    would see results for only one query. Serializing with a ~1 s gap
    plus a single 429 retry reliably fills every group.
    """
    normalized = _normalize_queries(queries)
    if not normalized:
        return []
    if not is_available():
        logger.warning("BRAVE_API_KEY is not configured; skipping search")
        return [{"query": q, "results": []} for q in normalized]

    groups: List[Dict[str, Any]] = []
    async with httpx.AsyncClient() as client:
        for i, q in enumerate(normalized):
            if i > 0:
                await asyncio.sleep(REQUEST_GAP_SECONDS)
            results = await _brave_search_one(client, q, count=count)
            groups.append({"query": q, "results": results})
    return groups


def format_results_for_model(groups: List[Dict[str, Any]]) -> str:
    """Compact, English rendering of search results for the LLM.

    Also spells out the citation convention the assistant must follow
    when drawing on these results. The frontend converts that marker
    into a styled, clickable pill.
    """
    if not groups:
        return (
            "Web search returned no results. "
            "Proceed without external citations."
        )
    has_any = any(g.get("results") for g in groups)
    if not has_any:
        joined = ", ".join(f'"{g.get("query", "")}"' for g in groups)
        return (
            f"Web search returned no results for: {joined}. "
            "Proceed without external citations."
        )

    lines: List[str] = ["Web search results:"]
    for g in groups:
        query = g.get("query") or ""
        results = g.get("results") or []
        if not results:
            lines.append(f'\n## Query: "{query}"\n(no results)')
            continue
        lines.append(f'\n## Query: "{query}"')
        for r in results:
            title = r.get("title") or ""
            url = r.get("url") or ""
            desc = r.get("description") or ""
            age = r.get("age") or ""
            age_part = f" ({age})" if age else ""
            lines.append(
                f"- {title}{age_part}\n  URL: {url}\n  Snippet: {desc}"
            )

    lines.append("")
    lines.append(
        'Cite sources inline as [source: "Short Title(Less than 5 words)", url: "<URL>"]. '
        "Use only URLs from the results above; never [1]/[2] or footnotes."
    )
    return "\n".join(lines)


BRAVE_TOOL_SCHEMA: Dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": (
            "Search the web. Pass 1-5 focused queries run in parallel."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "queries": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 1,
                    "maxItems": MAX_QUERIES_PER_CALL,
                    "description": "Focused queries, each targeting one aspect.",
                },
            },
            "required": ["queries"],
        },
    },
}
