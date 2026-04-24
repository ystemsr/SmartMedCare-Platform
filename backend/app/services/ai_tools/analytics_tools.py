"""Analytics / dashboard tools for admin & doctor."""

from __future__ import annotations

from typing import Any, Dict, List

from app.services.ai_tools.context import ToolContext, ToolResult
from app.services.ai_tools.registry import ToolSpec, register


# --------------------------------------------------------------------- get_dashboard_overview


async def _handle_dashboard_overview(args: dict, ctx: ToolContext) -> ToolResult:
    from app.services.dashboard import DashboardService

    overview = await DashboardService.get_overview(ctx.db)
    d = overview.model_dump() if hasattr(overview, "model_dump") else dict(overview.__dict__)
    stat_cards = [
        {"label": "老人总数", "value": d.get("elder_total", 0)},
        {"label": "高风险老人", "value": d.get("high_risk_total", 0)},
        {"label": "待处理预警", "value": d.get("pending_alert_total", 0)},
        {"label": "待办随访", "value": d.get("todo_followup_total", 0)},
        {"label": "今日完成随访", "value": d.get("completed_followup_today", 0)},
        {"label": "今日评估", "value": d.get("assessment_total_today", 0)},
    ]
    text = (
        f"平台概览：老人 {d.get('elder_total', 0)} 人；高风险 {d.get('high_risk_total', 0)} 人；"
        f"待处理预警 {d.get('pending_alert_total', 0)} 条；待办随访 {d.get('todo_followup_total', 0)} 条。"
    )
    return ToolResult(
        ok=True,
        model_text=text,
        ui_payload={"stat_cards": stat_cards, "raw": d},
        ui_bubble_type="chart",
    )


register(
    ToolSpec(
        name="get_dashboard_overview",
        description="Return top-level platform stats (elder count, high-risk count, pending alerts, todo followups).",
        parameters={"type": "object", "properties": {}},
        handler=_handle_dashboard_overview,
        allowed_roles={"admin", "doctor"},
        required_permission="analytics:read",
        action="read",
        ui_bubble_type="chart",
    )
)


# --------------------------------------------------------------------- get_risk_distribution


async def _handle_risk_distribution(args: dict, ctx: ToolContext) -> ToolResult:
    from app.services.analytics import AnalyticsService

    rows = await AnalyticsService.get_risk_distribution(ctx.db)
    items = [
        {"label": r.risk_level, "count": r.count}
        for r in rows
    ]
    total = sum(it["count"] for it in items)
    for it in items:
        it["ratio"] = round(it["count"] / total, 3) if total else 0.0
    summary = "、".join(f"{it['label']} {it['count']}" for it in items) or "暂无数据"
    return ToolResult(
        ok=True,
        model_text=f"风险分布（共 {total}）：{summary}",
        ui_payload={"dimension": "risk_level", "total": total, "series": items},
        ui_bubble_type="chart",
    )


register(
    ToolSpec(
        name="get_risk_distribution",
        description="Return count of elders by risk_level (low/medium/high/critical).",
        parameters={"type": "object", "properties": {}},
        handler=_handle_risk_distribution,
        allowed_roles={"admin", "doctor"},
        required_permission="analytics:read",
        action="read",
        ui_bubble_type="chart",
    )
)


# --------------------------------------------------------------------- get_alert_trend


async def _handle_alert_trend(args: dict, ctx: ToolContext) -> ToolResult:
    from app.services.analytics import AnalyticsService

    days = int(args.get("days") or 30)
    range_ = "7d" if days <= 7 else "30d" if days <= 30 else "90d"
    rows = await AnalyticsService.get_alert_trend(ctx.db, range_=range_, granularity="day")
    series = [{"date": r.date, "count": r.count} for r in rows]
    if series:
        peak = max(series, key=lambda s: s["count"])
        avg = sum(s["count"] for s in series) / len(series)
        summary = f"近 {range_} 预警趋势：最高日 {peak['date']}（{peak['count']} 条），日均 {avg:.1f} 条。"
    else:
        summary = f"近 {range_} 无预警数据。"
    return ToolResult(
        ok=True,
        model_text=summary,
        ui_payload={"range": range_, "granularity": "day", "series": series},
        ui_bubble_type="chart",
    )


register(
    ToolSpec(
        name="get_alert_trend",
        description="Return daily alert counts for the past N days (7/30/90).",
        parameters={
            "type": "object",
            "properties": {
                "days": {"type": "integer", "enum": [7, 30, 90], "default": 30},
            },
        },
        handler=_handle_alert_trend,
        allowed_roles={"admin", "doctor"},
        required_permission="analytics:read",
        action="read",
        ui_bubble_type="chart",
    )
)


# --------------------------------------------------------------------- get_followup_completion_rate


async def _handle_followup_completion(args: dict, ctx: ToolContext) -> ToolResult:
    from app.services.analytics import AnalyticsService

    rows = await AnalyticsService.get_followup_completion(ctx.db)
    items = [
        {"period": r.period, "total": r.total, "completed": r.completed, "rate": r.rate}
        for r in rows
    ]
    if items:
        latest = items[-1]
        summary = f"随访完成率（按月）：最新月 {latest['period']} 共 {latest['total']} 条，已完成 {latest['completed']}，完成率 {latest['rate']*100:.1f}%。"
    else:
        summary = "暂无随访完成率数据。"
    return ToolResult(
        ok=True,
        model_text=summary,
        ui_payload={"series": items},
        ui_bubble_type="chart",
    )


register(
    ToolSpec(
        name="get_followup_completion_rate",
        description="Return followup completion rate by month.",
        parameters={"type": "object", "properties": {}},
        handler=_handle_followup_completion,
        allowed_roles={"admin", "doctor"},
        required_permission="analytics:read",
        action="read",
        ui_bubble_type="chart",
    )
)


# --------------------------------------------------------------------- get_age_distribution


async def _handle_age_distribution(args: dict, ctx: ToolContext) -> ToolResult:
    from app.services.analytics import AnalyticsService

    rows = await AnalyticsService.get_age_distribution(ctx.db)
    items = [{"range": r.age_range, "count": r.count} for r in rows]
    total = sum(it["count"] for it in items)
    summary = "、".join(f"{it['range']}: {it['count']}" for it in items) or "暂无数据"
    return ToolResult(
        ok=True,
        model_text=f"年龄分布（共 {total}）：{summary}",
        ui_payload={"total": total, "buckets": items},
        ui_bubble_type="chart",
    )


register(
    ToolSpec(
        name="get_age_distribution",
        description="Return elder count by age bucket (admin-only).",
        parameters={"type": "object", "properties": {}},
        handler=_handle_age_distribution,
        allowed_roles={"admin"},
        required_permission="analytics:read",
        action="read",
        ui_bubble_type="chart",
    )
)
