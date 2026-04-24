"""Shared helpers for AI tool handlers.

Centralises the two context-bloat concerns that showed up during review:

1. **List model_text cap** — a tool that returns 50 rows would otherwise
   feed all 50 lines back to the LLM on every subsequent turn of the
   conversation. We cap the *model-facing* text to a small head slice +
   a "还有 N 条未展示" tail, while the full list stays in `ui_payload`
   for the chat bubble. The LLM can still follow up with pagination
   (`page` arg) or `get_*_detail(id)` to drill in.

2. **Heavy-blob stripping** — `feature_inputs` (the 20-feature JSON
   snapshot) is legitimate in `get_assessment_detail` but pure dead
   weight in a `list_assessments` row. `strip_heavy` drops it from list
   items without mutating the source payload.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional


MODEL_TEXT_ITEM_CAP = 15


def cap_model_lines(
    header: str,
    lines: List[str],
    total: int,
    *,
    cap: int = MODEL_TEXT_ITEM_CAP,
    tail_hint: str = "以上是前 {n} 条；共 {total} 条，如需更多请调用下一页或详情工具。",
) -> str:
    """Join a header + N body lines capped to `cap`, append a tail hint
    when truncated. Returns a single model-facing text block."""
    if len(lines) <= cap:
        return "\n".join([header, *lines])
    truncated = lines[:cap]
    return "\n".join(
        [header, *truncated, tail_hint.format(n=cap, total=total)]
    )


_HEAVY_KEYS: frozenset[str] = frozenset(
    {
        # Full 20-feature snapshot — useful in detail, noisy in lists
        "feature_inputs",
        # Raw long-form text fields that have a digest elsewhere
        "description",
        "content",
    }
)


def strip_heavy(items: Iterable[Dict[str, Any]], *, keys: Optional[Iterable[str]] = None) -> List[Dict[str, Any]]:
    """Return a shallow-cloned list of items with heavy keys removed.

    `keys` overrides the default set when a caller knows its shape.
    """
    drop = set(keys) if keys is not None else set(_HEAVY_KEYS)
    out: List[Dict[str, Any]] = []
    for it in items:
        if not isinstance(it, dict):
            out.append(it)
            continue
        out.append({k: v for k, v in it.items() if k not in drop})
    return out


def page_count(total: int, page_size: int) -> int:
    if page_size <= 0:
        return 1
    return max(1, (total + page_size - 1) // page_size)
