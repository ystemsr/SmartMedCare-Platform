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

from typing import Any, Dict, Iterable, List, Optional, Tuple

from app.services.ai_tools.context import ToolContext, ToolResult


MODEL_TEXT_ITEM_CAP = 15


def resolve_scoped_elder_id(
    ctx: ToolContext,
    raw: Any,
    *,
    bubble: str = "text",
) -> Tuple[Optional[int], Optional[ToolResult]]:
    """Resolve an elder_id for single-elder tools, with scope-aware auto-fill.

    Behavior:
      - If the caller supplied `raw`, coerce it to int and let the caller
        enforce scope as usual.
      - Otherwise, if the caller is elder/family and has exactly one
        linked elder, auto-fill from `ctx.scoped_elder_ids`.
      - Family with multiple linked elders gets a helpful error listing
        the bound ids so the LLM can re-call with the right one.
      - Admin/doctor (unrestricted scope) must provide `elder_id` — we
        refuse to guess for them.

    Returns `(elder_id, None)` on success, or `(None, ToolResult)` on
    failure; callers should forward the ToolResult directly.
    """
    if raw is not None:
        try:
            return int(raw), None
        except (TypeError, ValueError):
            return None, ToolResult.fail(
                "elder_id 必须是整数", bubble=bubble
            )

    scope = ctx.scoped_elder_ids
    if scope is None:
        return None, ToolResult.fail(
            "请提供 elder_id（管理员/医生调用必填）", bubble=bubble
        )
    if not scope:
        return None, ToolResult.fail(
            "尚未关联任何老人档案。"
            + ("请先绑定家属邀请码。" if ctx.role_code == "family" else ""),
            bubble=bubble,
        )
    if len(scope) == 1:
        return scope[0], None
    ids_txt = "、".join(str(i) for i in scope)
    return None, ToolResult.fail(
        f"您已绑定 {len(scope)} 位老人（ID: {ids_txt}），请指定 elder_id 或先调用 get_my_elder。",
        bubble=bubble,
    )


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
