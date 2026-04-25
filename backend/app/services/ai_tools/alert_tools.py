"""Alert (risk-warning) tools: read + idempotent status transitions."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select

from app.models.alert import Alert
from app.models.elder import Elder
from app.models.base import _utcnow
from app.services.ai_tools._common import cap_model_lines
from app.services.ai_tools.context import ToolContext, ToolResult
from app.services.ai_tools.registry import ToolSpec, register


def _parse_date(v: Any) -> Optional[datetime]:
    if not v:
        return None
    try:
        return datetime.fromisoformat(str(v))
    except ValueError:
        return None


async def _elder_name_map(ctx: ToolContext, elder_ids: List[int]) -> Dict[int, str]:
    if not elder_ids:
        return {}
    rows = (
        await ctx.db.execute(select(Elder.id, Elder.name).where(Elder.id.in_(elder_ids)))
    ).all()
    return {r[0]: r[1] for r in rows}


def _alert_to_dict(a: Alert, elder_name: Optional[str]) -> Dict[str, Any]:
    return {
        "id": a.id,
        "elder_id": a.elder_id,
        "elder_name": elder_name,
        "type": a.type,
        "title": a.title,
        "description": a.description,
        "risk_level": a.risk_level,
        "status": a.status,
        "source": a.source,
        "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
        "remark": a.remark,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


# --------------------------------------------------------------------- list_alerts


async def _do_list_alerts(args: dict, ctx: ToolContext, *, force_scope: bool) -> ToolResult:
    page = max(1, int(args.get("page") or 1))
    page_size = max(1, min(50, int(args.get("page_size") or 20)))
    stmt = select(Alert).where(Alert.deleted_at.is_(None))

    elder_id = args.get("elder_id")
    if elder_id is not None:
        eid = int(elder_id)
        ctx.enforce_elder_scope(eid)
        stmt = stmt.where(Alert.elder_id == eid)
    elif force_scope:
        if not ctx.scoped_elder_ids:
            return ToolResult(
                ok=True,
                model_text="未关联任何老人，暂无预警可查。",
                ui_payload={"total": 0, "page": page, "page_size": page_size, "items": []},
                ui_bubble_type="alert_list",
            )
        stmt = stmt.where(Alert.elder_id.in_(ctx.scoped_elder_ids))

    risk_level = args.get("risk_level")
    if risk_level in ("low", "medium", "high", "critical"):
        stmt = stmt.where(Alert.risk_level == risk_level)
    status = args.get("status")
    # Align with the alerts table enum: pending → processing → resolved/ignored.
    if status in ("pending", "processing", "resolved", "ignored"):
        stmt = stmt.where(Alert.status == status)

    df = _parse_date(args.get("date_from"))
    dt = _parse_date(args.get("date_to"))
    if df:
        stmt = stmt.where(Alert.triggered_at >= df)
    if dt:
        stmt = stmt.where(Alert.triggered_at <= dt)

    days_back = args.get("days_back")
    if days_back:
        try:
            days = int(days_back)
            cutoff = _utcnow()
            from datetime import timedelta
            stmt = stmt.where(Alert.triggered_at >= cutoff - timedelta(days=days))
        except (TypeError, ValueError):
            pass

    total = (await ctx.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    stmt = (
        stmt.order_by(Alert.triggered_at.desc(), Alert.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await ctx.db.execute(stmt)).scalars().all()
    name_map = await _elder_name_map(ctx, [r.elder_id for r in rows])
    items = [_alert_to_dict(r, name_map.get(r.elder_id)) for r in rows]

    if not items:
        return ToolResult(
            ok=True,
            model_text="该条件下暂无预警。",
            ui_payload={"total": 0, "page": page, "page_size": page_size, "items": []},
            ui_bubble_type="alert_list",
        )
    header = f"共 {total} 条预警（第 {page} 页）："
    body: List[str] = []
    for it in items:
        ts = (it["triggered_at"] or "")[:16].replace("T", " ") or "时间未知"
        body.append(
            f"- [ID {it['id']}] {it['title']} | {it['elder_name'] or '?'} | "
            f"风险={it['risk_level']} | 状态={it['status']} | {ts}"
        )
    return ToolResult(
        ok=True,
        model_text=cap_model_lines(header, body, total),
        ui_payload={"total": total, "page": page, "page_size": page_size, "items": items},
        ui_bubble_type="alert_list",
    )


async def _handle_list_alerts(args: dict, ctx: ToolContext) -> ToolResult:
    return await _do_list_alerts(args, ctx, force_scope=False)


async def _handle_list_my_alerts(args: dict, ctx: ToolContext) -> ToolResult:
    # Force scope to linked elders; ignores any client-supplied elder_id outside scope
    eid = args.get("elder_id")
    if eid is not None:
        try:
            ctx.enforce_elder_scope(int(eid))
        except Exception:
            return ToolResult.fail("elder_id 不在可访问范围内", bubble="alert_list")
    return await _do_list_alerts(args, ctx, force_scope=True)


register(
    ToolSpec(
        name="list_alerts",
        description="List risk-warning alerts with filters. Admin/doctor use. Doctor only sees alerts for their assigned elders.",
        parameters={
            "type": "object",
            "properties": {
                "elder_id": {"type": "integer"},
                "risk_level": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
                "status": {"type": "string", "enum": ["pending", "processing", "resolved", "ignored"]},
                "date_from": {"type": "string"},
                "date_to": {"type": "string"},
                "days_back": {"type": "integer", "description": "shortcut: last N days by triggered_at"},
                "page": {"type": "integer", "minimum": 1, "default": 1},
                "page_size": {"type": "integer", "minimum": 1, "maximum": 30, "default": 10},
            },
        },
        handler=_handle_list_alerts,
        allowed_roles={"admin", "doctor"},
        required_permission="alert:read",
        action="read",
        ui_bubble_type="alert_list",
    )
)


register(
    ToolSpec(
        name="list_my_alerts",
        description="For elder/family callers: list alerts for your own/linked elder(s).",
        parameters={
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["pending", "processing", "resolved", "ignored"]},
                "risk_level": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
                "days_back": {"type": "integer"},
                "page": {"type": "integer", "minimum": 1, "default": 1},
                "page_size": {"type": "integer", "minimum": 1, "maximum": 30, "default": 10},
            },
        },
        handler=_handle_list_my_alerts,
        allowed_roles={"elder", "family"},
        required_permission="alert:read",
        action="read",
        ui_bubble_type="alert_list",
    )
)


# --------------------------------------------------------------------- get_alert_detail


async def _handle_get_alert_detail(args: dict, ctx: ToolContext) -> ToolResult:
    try:
        alert_id = int(args.get("alert_id"))
    except (TypeError, ValueError):
        return ToolResult.fail("alert_id 必填且必须是整数", bubble="alert_card")
    stmt = select(Alert).where(Alert.id == alert_id, Alert.deleted_at.is_(None))
    row = (await ctx.db.execute(stmt)).scalar_one_or_none()
    if row is None:
        return ToolResult.fail(f"未找到预警 #{alert_id}", bubble="alert_card")
    ctx.enforce_elder_scope(row.elder_id)
    name_map = await _elder_name_map(ctx, [row.elder_id])
    data = _alert_to_dict(row, name_map.get(row.elder_id))
    model_text = (
        f"预警 #{data['id']}：{data['title']}\n"
        f"老人：{data['elder_name'] or data['elder_id']}\n"
        f"类型：{data['type']} | 风险：{data['risk_level']} | 状态：{data['status']}\n"
        f"触发时间：{(data['triggered_at'] or '')[:16].replace('T', ' ')}\n"
        f"描述：{data['description'] or '（无）'}"
    )
    return ToolResult(ok=True, model_text=model_text, ui_payload=data, ui_bubble_type="alert_card")


register(
    ToolSpec(
        name="get_alert_detail",
        description="Return a single alert's full detail.",
        parameters={
            "type": "object",
            "properties": {"alert_id": {"type": "integer"}},
            "required": ["alert_id"],
        },
        handler=_handle_get_alert_detail,
        allowed_roles={"admin", "doctor", "elder", "family"},
        required_permission="alert:read",
        action="read",
        ui_bubble_type="alert_card",
    )
)


# --------------------------------------------------------------------- alert status transitions
#
# Alert status vocabulary (from the DB enum): pending → processing →
# resolved / ignored. Terminal statuses don't transition further.
# We expose three write tools that map 1:1 to each forward transition:
#   - process_alert   (pending → processing)
#   - resolve_alert   (pending/processing → resolved)
#   - ignore_alert    (pending/processing → ignored)
#
# All three reuse AlertService.update_status, which already enforces the
# transition FSM and throws AlertStatusTransitionError on illegal moves.
# Idempotency: the service treats "same status" as a no-op already; we
# translate that into a friendly "unchanged (idempotent)" result.


async def _apply_status_transition(
    args: dict,
    ctx: ToolContext,
    *,
    target_status: str,
    note_key: str,
    note_label: str,
    required: bool,
) -> ToolResult:
    from app.services.alert import AlertService, AlertStatusTransitionError

    try:
        alert_id = int(args.get("alert_id"))
    except (TypeError, ValueError):
        return ToolResult.fail("alert_id 必填且必须是整数", bubble="alert_card")
    note = (args.get(note_key) or "").strip()
    if required and not note:
        return ToolResult.fail(
            f"{note_label} 不能为空", bubble="alert_card"
        )

    row = (
        await ctx.db.execute(
            select(Alert).where(Alert.id == alert_id, Alert.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if row is None:
        return ToolResult.fail(f"未找到预警 #{alert_id}", bubble="alert_card")
    ctx.enforce_elder_scope(row.elder_id)

    previous_status = row.status
    remark_tag = f"[{target_status}] {note}" if note else None

    # Same-status → idempotent no-op; compose the remark only if provided.
    if previous_status == target_status:
        name_map = await _elder_name_map(ctx, [row.elder_id])
        data = _alert_to_dict(row, name_map.get(row.elder_id))
        data["previous_status"] = previous_status
        data["changed"] = False
        if note:
            data[note_key] = note
        return ToolResult(
            ok=True,
            model_text=(
                f"预警 #{alert_id} 已处于 {target_status} 状态，未作变更（幂等）。"
            ),
            ui_payload=data,
            ui_bubble_type="alert_card",
        )

    try:
        await AlertService.update_status(
            ctx.db, alert_id, target_status, remark_tag
        )
    except AlertStatusTransitionError as e:
        return ToolResult.fail(str(e), bubble="alert_card")

    # Re-fetch for the fresh row (service commits + updates columns).
    row = (
        await ctx.db.execute(
            select(Alert).where(Alert.id == alert_id, Alert.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    name_map = await _elder_name_map(ctx, [row.elder_id])
    data = _alert_to_dict(row, name_map.get(row.elder_id))
    data["previous_status"] = previous_status
    data["changed"] = True
    if note:
        data[note_key] = note
    return ToolResult(
        ok=True,
        model_text=(
            f"预警 #{alert_id} 状态已变更：{previous_status} → {target_status}。"
        ),
        ui_payload=data,
        ui_bubble_type="alert_card",
    )


async def _handle_process_alert(args: dict, ctx: ToolContext) -> ToolResult:
    return await _apply_status_transition(
        args, ctx, target_status="processing",
        note_key="note", note_label="备注", required=False,
    )


async def _handle_resolve_alert(args: dict, ctx: ToolContext) -> ToolResult:
    return await _apply_status_transition(
        args, ctx, target_status="resolved",
        note_key="resolution", note_label="处理说明", required=True,
    )


async def _handle_ignore_alert(args: dict, ctx: ToolContext) -> ToolResult:
    return await _apply_status_transition(
        args, ctx, target_status="ignored",
        note_key="reason", note_label="忽略原因", required=True,
    )


register(
    ToolSpec(
        name="process_alert",
        description=(
            "Move an alert from `pending` to `processing` (doctor starts handling it). "
            "Idempotent — re-calling on an already-processing alert is a no-op."
        ),
        parameters={
            "type": "object",
            "properties": {
                "alert_id": {"type": "integer"},
                "note": {"type": "string"},
            },
            "required": ["alert_id"],
        },
        handler=_handle_process_alert,
        allowed_roles={"doctor"},
        required_permission="alert:update",
        action="write",
        ui_bubble_type="alert_card",
    )
)


register(
    ToolSpec(
        name="resolve_alert",
        description=(
            "Close an alert with a resolution note (terminal). "
            "Allowed from pending or processing. Idempotent on already-resolved alerts."
        ),
        parameters={
            "type": "object",
            "properties": {
                "alert_id": {"type": "integer"},
                "resolution": {"type": "string", "minLength": 1},
            },
            "required": ["alert_id", "resolution"],
        },
        handler=_handle_resolve_alert,
        allowed_roles={"doctor"},
        required_permission="alert:update",
        action="write",
        ui_bubble_type="alert_card",
    )
)


register(
    ToolSpec(
        name="ignore_alert",
        description=(
            "Dismiss an alert as a false positive / not actionable, with a reason (terminal). "
            "Allowed from pending or processing."
        ),
        parameters={
            "type": "object",
            "properties": {
                "alert_id": {"type": "integer"},
                "reason": {"type": "string", "minLength": 1},
            },
            "required": ["alert_id", "reason"],
        },
        handler=_handle_ignore_alert,
        allowed_roles={"doctor"},
        required_permission="alert:update",
        action="write",
        ui_bubble_type="alert_card",
    )
)
