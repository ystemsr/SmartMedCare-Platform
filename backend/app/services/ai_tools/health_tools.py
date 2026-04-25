"""Health record tools.

Two audiences share the underlying query + formatting logic, but the
tool *registrations* are deliberately split so each audience sees a
description tuned to how they'll actually use it:

  - admin / doctor: `list_health_records`, `get_latest_vitals` — require
    `elder_id`, describing the tool in terms of looking up another
    person's record.
  - elder / family: `list_my_health_records`, `get_my_latest_vitals` —
    no `elder_id` argument; the elder is resolved from the caller's
    scope (the caller's own archive, or their single linked elder).
    Family with multiple linked elders must fall back to the admin-style
    tool or pass an id — handled by `resolve_scoped_elder_id`.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select

from app.models.health_archive import HealthRecord
from app.services.ai_tools._common import cap_model_lines, resolve_scoped_elder_id
from app.services.ai_tools.context import ToolContext, ToolResult
from app.services.ai_tools.registry import ToolSpec, register


def _decimal_to_float(v: Any) -> Any:
    if isinstance(v, Decimal):
        return float(v)
    return v


def _record_to_dict(r: HealthRecord) -> Dict[str, Any]:
    return {
        "id": r.id,
        "elder_id": r.elder_id,
        "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
        "bp_sys": r.blood_pressure_systolic,
        "bp_dia": r.blood_pressure_diastolic,
        "heart_rate": r.heart_rate,
        "blood_glucose": _decimal_to_float(r.blood_glucose),
        "temperature": _decimal_to_float(r.temperature),
        "height_cm": _decimal_to_float(r.height_cm),
        "weight_kg": _decimal_to_float(r.weight_kg),
        "chronic_diseases": r.chronic_diseases or [],
        "allergies": r.allergies or [],
    }


def _flag_abnormal(r: Dict[str, Any]) -> List[str]:
    flags: List[str] = []
    if r.get("bp_sys") is not None and r["bp_sys"] >= 140:
        flags.append("bp_high")
    if r.get("bp_dia") is not None and r["bp_dia"] >= 90:
        flags.append("bp_diastolic_high")
    if r.get("blood_glucose") is not None and r["blood_glucose"] >= 7.0:
        flags.append("glucose_high")
    if r.get("heart_rate") is not None:
        if r["heart_rate"] > 100:
            flags.append("hr_high")
        elif r["heart_rate"] < 50:
            flags.append("hr_low")
    if r.get("temperature") is not None and r["temperature"] >= 37.3:
        flags.append("fever")
    return flags


def _parse_date(v: Any) -> Optional[datetime]:
    if not v:
        return None
    s = str(v)
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


# --------------------------------------------------------------------- shared core


async def _list_records_core(
    ctx: ToolContext,
    *,
    elder_id: int,
    date_from: Optional[str],
    date_to: Optional[str],
    page: int,
    page_size: int,
) -> ToolResult:
    ctx.enforce_elder_scope(elder_id)
    stmt = select(HealthRecord).where(
        HealthRecord.elder_id == elder_id,
        HealthRecord.deleted_at.is_(None),
    )
    df = _parse_date(date_from)
    dt = _parse_date(date_to)
    if df:
        stmt = stmt.where(HealthRecord.recorded_at >= df)
    if dt:
        stmt = stmt.where(HealthRecord.recorded_at <= dt)

    total = (await ctx.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    stmt = (
        stmt.order_by(HealthRecord.recorded_at.desc(), HealthRecord.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await ctx.db.execute(stmt)).scalars().all()
    items = [_record_to_dict(r) for r in rows]

    if not items:
        return ToolResult(
            ok=True,
            model_text="该时间段内无健康记录。",
            ui_payload={"total": total, "page": page, "page_size": page_size, "items": []},
            ui_bubble_type="health_records",
        )

    header = f"共 {total} 条健康记录（第 {page} 页）："
    body: List[str] = []
    for it in items:
        ts = (it["recorded_at"] or "").replace("T", " ")[:16]
        parts = []
        if it["bp_sys"] is not None and it["bp_dia"] is not None:
            parts.append(f"BP {it['bp_sys']}/{it['bp_dia']}")
        if it["heart_rate"] is not None:
            parts.append(f"心率 {it['heart_rate']}")
        if it["blood_glucose"] is not None:
            parts.append(f"血糖 {it['blood_glucose']}")
        if it["temperature"] is not None:
            parts.append(f"体温 {it['temperature']}")
        if it["weight_kg"] is not None:
            parts.append(f"体重 {it['weight_kg']}")
        body.append(f"- {ts} | " + (" | ".join(parts) if parts else "(空)"))
    return ToolResult(
        ok=True,
        model_text=cap_model_lines(header, body, total),
        ui_payload={"total": total, "page": page, "page_size": page_size, "items": items},
        ui_bubble_type="health_records",
    )


async def _latest_vital_core(ctx: ToolContext, *, elder_id: int) -> ToolResult:
    ctx.enforce_elder_scope(elder_id)
    stmt = (
        select(HealthRecord)
        .where(HealthRecord.elder_id == elder_id, HealthRecord.deleted_at.is_(None))
        .order_by(HealthRecord.recorded_at.desc(), HealthRecord.id.desc())
        .limit(1)
    )
    row = (await ctx.db.execute(stmt)).scalar_one_or_none()
    if row is None:
        return ToolResult(
            ok=True,
            model_text="该老人暂无健康记录。",
            ui_payload={"elder_id": elder_id, "exists": False},
            ui_bubble_type="health_records",
        )
    item = _record_to_dict(row)
    flags = _flag_abnormal(item)
    parts = []
    if item["bp_sys"] is not None and item["bp_dia"] is not None:
        parts.append(f"血压 {item['bp_sys']}/{item['bp_dia']}")
    if item["heart_rate"] is not None:
        parts.append(f"心率 {item['heart_rate']}")
    if item["blood_glucose"] is not None:
        parts.append(f"血糖 {item['blood_glucose']} mmol/L")
    if item["temperature"] is not None:
        parts.append(f"体温 {item['temperature']}℃")
    ts = (item["recorded_at"] or "")[:16].replace("T", " ")

    # Staleness indicator — helps the model judge whether to suggest a
    # fresh measurement without the doctor eyeballing the timestamp.
    days_since: Optional[int] = None
    if row.recorded_at is not None:
        delta = datetime.utcnow() - row.recorded_at
        days_since = max(0, delta.days)
    staleness = f" 距上次记录 {days_since} 天" if days_since is not None else ""

    model_text = (
        f"最新体征（{ts}{staleness}）：" + "，".join(parts) + "。"
        + (f" 异常：{','.join(flags)}" if flags else "")
    )
    return ToolResult(
        ok=True,
        model_text=model_text,
        ui_payload={
            "elder_id": elder_id,
            "exists": True,
            "recorded_at": item["recorded_at"],
            "days_since_last": days_since,
            "vitals": {
                "bp_sys": item["bp_sys"],
                "bp_dia": item["bp_dia"],
                "heart_rate": item["heart_rate"],
                "blood_glucose": item["blood_glucose"],
                "temperature": item["temperature"],
                "weight_kg": item["weight_kg"],
                "height_cm": item["height_cm"],
            },
            "abnormal_flags": flags,
        },
        ui_bubble_type="health_records",
    )


# --------------------------------------------------------------------- list_health_records (admin/doctor)


async def _handle_list_health_records(args: dict, ctx: ToolContext) -> ToolResult:
    try:
        elder_id = int(args.get("elder_id"))
    except (TypeError, ValueError):
        return ToolResult.fail("elder_id 必填且必须是整数", bubble="health_records")
    page = max(1, int(args.get("page") or 1))
    page_size = max(1, min(50, int(args.get("page_size") or 20)))
    return await _list_records_core(
        ctx,
        elder_id=elder_id,
        date_from=args.get("date_from"),
        date_to=args.get("date_to"),
        page=page,
        page_size=page_size,
    )


register(
    ToolSpec(
        name="list_health_records",
        description="List health records (vitals) for an elder, most recent first. Supports date range and pagination.",
        parameters={
            "type": "object",
            "properties": {
                "elder_id": {"type": "integer", "description": "target elder id"},
                "date_from": {"type": "string", "description": "ISO date or datetime"},
                "date_to": {"type": "string"},
                "page": {"type": "integer", "minimum": 1, "default": 1},
                "page_size": {"type": "integer", "minimum": 1, "maximum": 30, "default": 10},
            },
            "required": ["elder_id"],
        },
        handler=_handle_list_health_records,
        allowed_roles={"admin", "doctor"},
        required_permission="health_record:read",
        action="read",
        ui_bubble_type="health_records",
    )
)


# --------------------------------------------------------------------- list_my_health_records (elder/family)


async def _handle_list_my_health_records(args: dict, ctx: ToolContext) -> ToolResult:
    elder_id, err = resolve_scoped_elder_id(
        ctx, args.get("elder_id"), bubble="health_records"
    )
    if err is not None:
        return err
    page = max(1, int(args.get("page") or 1))
    page_size = max(1, min(50, int(args.get("page_size") or 20)))
    return await _list_records_core(
        ctx,
        elder_id=elder_id,
        date_from=args.get("date_from"),
        date_to=args.get("date_to"),
        page=page,
        page_size=page_size,
    )


register(
    ToolSpec(
        name="list_my_health_records",
        description="Self-service: list health records for the caller's linked elder. Supports date range and pagination.",
        parameters={
            "type": "object",
            "properties": {
                "elder_id": {
                    "type": "integer",
                    "description": "Only needed when the caller is linked to multiple elders.",
                },
                "date_from": {"type": "string", "description": "ISO date or datetime"},
                "date_to": {"type": "string"},
                "page": {"type": "integer", "minimum": 1, "default": 1},
                "page_size": {"type": "integer", "minimum": 1, "maximum": 30, "default": 10},
            },
        },
        handler=_handle_list_my_health_records,
        allowed_roles={"elder", "family"},
        required_permission="health_record:read",
        action="read",
        ui_bubble_type="health_records",
    )
)


# --------------------------------------------------------------------- get_latest_vitals (admin/doctor)


async def _handle_get_latest_vitals(args: dict, ctx: ToolContext) -> ToolResult:
    try:
        elder_id = int(args.get("elder_id"))
    except (TypeError, ValueError):
        return ToolResult.fail("elder_id 必填且必须是整数", bubble="health_records")
    return await _latest_vital_core(ctx, elder_id=elder_id)


register(
    ToolSpec(
        name="get_latest_vitals",
        description="Return the most recent health record for an elder, with abnormal-vital flags.",
        parameters={
            "type": "object",
            "properties": {
                "elder_id": {"type": "integer", "description": "target elder id"},
            },
            "required": ["elder_id"],
        },
        handler=_handle_get_latest_vitals,
        allowed_roles={"admin", "doctor"},
        required_permission="health_record:read",
        action="read",
        ui_bubble_type="health_records",
    )
)


# --------------------------------------------------------------------- get_my_latest_vitals (elder/family)


async def _handle_get_my_latest_vitals(args: dict, ctx: ToolContext) -> ToolResult:
    elder_id, err = resolve_scoped_elder_id(
        ctx, args.get("elder_id"), bubble="health_records"
    )
    if err is not None:
        return err
    return await _latest_vital_core(ctx, elder_id=elder_id)


register(
    ToolSpec(
        name="get_my_latest_vitals",
        description="Self-service: return the most recent health record for the caller's linked elder, with abnormal-vital flags.",
        parameters={
            "type": "object",
            "properties": {
                "elder_id": {
                    "type": "integer",
                    "description": "Only needed when the caller is linked to multiple elders.",
                },
            },
        },
        handler=_handle_get_my_latest_vitals,
        allowed_roles={"elder", "family"},
        required_permission="health_record:read",
        action="read",
        ui_bubble_type="health_records",
    )
)
