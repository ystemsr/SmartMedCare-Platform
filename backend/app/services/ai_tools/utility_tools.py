"""Utility tools available to every role.

- web_search: proxy to Brave Search (only registered when BRAVE_API_KEY
  is configured — otherwise the model wouldn't see it anyway because
  schemas_for would return the schema but calls would no-op).
- get_current_time: trivial but surprisingly useful — gives the LLM an
  anchored "now" without relying on training-cutoff guesses.
- get_weather: pulls the cached WeatherService snapshot (background job
  refreshes every ~15 min for the default city).
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from app.services.ai_tools.context import ToolContext, ToolResult
from app.services.ai_tools.registry import ToolSpec, register
from app.services.brave_search import (
    brave_search_many,
    format_results_for_model,
    is_available as brave_is_available,
)
from app.services.weather import WeatherService


ALL_ROLES = {"admin", "doctor", "elder", "family"}


# --------------------------------------------------------------------- web_search


async def _handle_web_search(args: dict, ctx: ToolContext) -> ToolResult:
    raw_queries = args.get("queries")
    if raw_queries is None and args.get("query"):
        raw_queries = [args.get("query")]
    if isinstance(raw_queries, str):
        raw_queries = [raw_queries]
    if not isinstance(raw_queries, list):
        raw_queries = []
    queries = [str(q).strip() for q in raw_queries if str(q).strip()]
    if not queries:
        return ToolResult.fail("queries 参数不能为空", bubble="search")

    groups = await brave_search_many(queries)
    return ToolResult(
        ok=True,
        model_text=format_results_for_model(groups),
        ui_payload={
            "queries": [g.get("query", "") for g in groups],
            "groups": groups,
        },
        ui_bubble_type="search",
    )


register(
    ToolSpec(
        name="web_search",
        description="Search the web. Pass 1-5 focused queries run in parallel.",
        parameters={
            "type": "object",
            "properties": {
                "queries": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 1,
                    "maxItems": 5,
                    "description": "Focused queries, each targeting one aspect.",
                },
            },
            "required": ["queries"],
        },
        handler=_handle_web_search,
        allowed_roles=set(ALL_ROLES),
        action="read",
        ui_bubble_type="search",
    )
)


# --------------------------------------------------------------------- get_current_time


_WEEKDAY_ZH = ["一", "二", "三", "四", "五", "六", "日"]


async def _handle_get_current_time(args: dict, ctx: ToolContext) -> ToolResult:
    tz_name = (args.get("tz") or "Asia/Shanghai").strip() or "Asia/Shanghai"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:  # noqa: BLE001
        tz = ZoneInfo("Asia/Shanghai")
        tz_name = "Asia/Shanghai"
    now = datetime.now(tz)
    weekday = _WEEKDAY_ZH[now.weekday()]
    iso = now.isoformat(timespec="seconds")
    display = now.strftime("%Y-%m-%d %H:%M:%S")
    text = f"当前时间：{display}（星期{weekday}，{tz_name}）"
    return ToolResult(
        ok=True,
        model_text=text,
        ui_payload={
            "iso": iso,
            "tz": tz_name,
            "weekday_zh": weekday,
            "display": display,
        },
        ui_bubble_type="text",
    )


register(
    ToolSpec(
        name="get_current_time",
        description="Return the current wall-clock time in the given timezone (default Asia/Shanghai).",
        parameters={
            "type": "object",
            "properties": {
                "tz": {
                    "type": "string",
                    "description": "IANA timezone name, e.g. Asia/Shanghai, UTC.",
                },
            },
        },
        handler=_handle_get_current_time,
        allowed_roles=set(ALL_ROLES),
        action="read",
        ui_bubble_type="text",
    )
)


# --------------------------------------------------------------------- get_weather


async def _handle_get_weather(args: dict, ctx: ToolContext) -> ToolResult:
    snapshot = WeatherService.snapshot()
    if snapshot is None:
        return ToolResult(
            ok=True,
            model_text="天气数据暂不可用（可能未配置 WEATHER_API_KEY 或正在首次加载）。",
            ui_payload={"available": False},
            ui_bubble_type="weather",
        )
    city = snapshot.get("city") or ""
    desc = snapshot.get("description") or snapshot.get("main") or ""
    temp = snapshot.get("temp")
    feels = snapshot.get("feels_like")
    humidity = snapshot.get("humidity")
    parts = [f"{city} 当前天气：{desc}"]
    if temp is not None:
        parts.append(f"气温 {temp}℃")
    if feels is not None:
        parts.append(f"体感 {feels}℃")
    if humidity is not None:
        parts.append(f"湿度 {humidity}%")
    return ToolResult(
        ok=True,
        model_text="，".join(parts) + "。",
        ui_payload={"available": True, **snapshot},
        ui_bubble_type="weather",
    )


register(
    ToolSpec(
        name="get_weather",
        description="Return the latest cached weather snapshot for the platform's default city.",
        parameters={
            "type": "object",
            "properties": {},
        },
        handler=_handle_get_weather,
        allowed_roles=set(ALL_ROLES),
        action="read",
        ui_bubble_type="weather",
    )
)


def web_search_registered_if_available() -> bool:
    """Convenience flag — chat endpoint uses this to skip prompt-level
    hinting when Brave isn't configured."""
    return brave_is_available()
