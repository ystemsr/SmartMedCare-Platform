"""Followup plan + record tools: list (admin/doctor/scoped) + idempotent writes."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select

from app.models.elder import Elder
from app.models.followup import Followup, FollowupRecord
from app.models.user import User
from app.services.ai_tools._common import cap_model_lines
from app.services.ai_tools.context import ToolContext, ToolResult
from app.services.ai_tools.registry import ToolSpec, register


def _parse_dt(v: Any) -> Optional[datetime]:
    if not v:
        return None
    try:
        return datetime.fromisoformat(str(v))
    except ValueError:
        return None


def _fu_to_dict(
    f: Followup, elder_name: Optional[str], assignee_name: Optional[str]
) -> Dict[str, Any]:
    return {
        "id": f.id,
        "elder_id": f.elder_id,
        "elder_name": elder_name,
        "plan_type": f.plan_type,
        "planned_at": f.planned_at.isoformat() if f.planned_at else None,
        "status": f.status,
        "assigned_to": f.assigned_to,
        "assigned_to_name": assignee_name,
        "notes": f.notes,
        "records_count": len(f.records or []),
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }


async def _do_list_followups(args: dict, ctx: ToolContext, *, force_scope: bool) -> ToolResult:
    page = max(1, int(args.get("page") or 1))
    page_size = max(1, min(50, int(args.get("page_size") or 20)))
    stmt = select(Followup).where(Followup.deleted_at.is_(None))

    eid = args.get("elder_id")
    if eid is not None:
        eid_int = int(eid)
        ctx.enforce_elder_scope(eid_int)
        stmt = stmt.where(Followup.elder_id == eid_int)
    elif force_scope:
        if not ctx.scoped_elder_ids:
            return ToolResult(
                ok=True,
                model_text="尚未关联任何老人。",
                ui_payload={"total": 0, "page": page, "page_size": page_size, "items": []},
                ui_bubble_type="followup_list",
            )
        stmt = stmt.where(Followup.elder_id.in_(ctx.scoped_elder_ids))

    status = args.get("status")
    if status:
        stmt = stmt.where(Followup.status == str(status))
    plan_type = args.get("plan_type")
    if plan_type:
        stmt = stmt.where(Followup.plan_type == str(plan_type))
    assigned_to = args.get("assigned_to")
    if assigned_to is not None:
        try:
            stmt = stmt.where(Followup.assigned_to == int(assigned_to))
        except (TypeError, ValueError):
            pass
    df = _parse_dt(args.get("date_from"))
    dt_ = _parse_dt(args.get("date_to"))
    if df:
        stmt = stmt.where(Followup.planned_at >= df)
    if dt_:
        stmt = stmt.where(Followup.planned_at <= dt_)

    # Doctor-only: restrict to own assignments
    role_names = {ur.role.name for ur in (ctx.current_user.user_roles or []) if ur.role}
    if ctx.role_code == "doctor" and "admin" not in role_names:
        stmt = stmt.where(Followup.assigned_to == ctx.current_user.id)

    total = (await ctx.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    stmt = (
        stmt.order_by(Followup.planned_at.desc(), Followup.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await ctx.db.execute(stmt)).scalars().all()

    eids = list({r.elder_id for r in rows})
    aids = list({r.assigned_to for r in rows if r.assigned_to is not None})
    name_map: Dict[int, str] = {}
    if eids:
        rr = (await ctx.db.execute(select(Elder.id, Elder.name).where(Elder.id.in_(eids)))).all()
        name_map = {r[0]: r[1] for r in rr}
    user_map: Dict[int, str] = {}
    if aids:
        rr = (
            await ctx.db.execute(
                select(User.id, User.real_name, User.username).where(User.id.in_(aids))
            )
        ).all()
        user_map = {r[0]: (r[1] or r[2]) for r in rr}
    items = [
        _fu_to_dict(r, name_map.get(r.elder_id), user_map.get(r.assigned_to or 0))
        for r in rows
    ]

    if not items:
        return ToolResult(
            ok=True,
            model_text="暂无随访计划。",
            ui_payload={"total": 0, "page": page, "page_size": page_size, "items": []},
            ui_bubble_type="followup_list",
        )
    header = f"共 {total} 条随访计划（第 {page} 页）："
    body: List[str] = []
    for it in items:
        ts = (it["planned_at"] or "")[:16].replace("T", " ") or "未定时间"
        body.append(
            f"- [ID {it['id']}] {it['elder_name'] or it['elder_id']} | {it['plan_type']} | "
            f"{ts} | 状态={it['status']} | 医生={it['assigned_to_name'] or '未分配'}"
        )
    return ToolResult(
        ok=True,
        model_text=cap_model_lines(header, body, total),
        ui_payload={"total": total, "page": page, "page_size": page_size, "items": items},
        ui_bubble_type="followup_list",
    )


async def _handle_list_followups(args: dict, ctx: ToolContext) -> ToolResult:
    return await _do_list_followups(args, ctx, force_scope=False)


async def _handle_list_my_followups(args: dict, ctx: ToolContext) -> ToolResult:
    return await _do_list_followups(args, ctx, force_scope=True)


register(
    ToolSpec(
        name="list_followups",
        description="List followup plans with filters. Doctor callers see only their own assignments.",
        parameters={
            "type": "object",
            "properties": {
                "elder_id": {"type": "integer"},
                "status": {"type": "string"},
                "plan_type": {"type": "string"},
                "assigned_to": {"type": "integer"},
                "date_from": {"type": "string"},
                "date_to": {"type": "string"},
                "page": {"type": "integer", "minimum": 1, "default": 1},
                "page_size": {"type": "integer", "minimum": 1, "maximum": 30, "default": 10},
            },
        },
        handler=_handle_list_followups,
        allowed_roles={"admin", "doctor"},
        required_permission="followup:create",
        action="read",
        ui_bubble_type="followup_list",
    )
)


register(
    ToolSpec(
        name="list_my_followups",
        description="For elder/family callers: list followup plans for the caller's own/linked elder(s).",
        parameters={
            "type": "object",
            "properties": {
                "status": {"type": "string"},
                "page": {"type": "integer", "minimum": 1, "default": 1},
                "page_size": {"type": "integer", "minimum": 1, "maximum": 30, "default": 10},
            },
        },
        handler=_handle_list_my_followups,
        allowed_roles={"elder", "family"},
        action="read",
        ui_bubble_type="followup_list",
    )
)


# --------------------------------------------------------------------- create_followup


async def _handle_create_followup(args: dict, ctx: ToolContext) -> ToolResult:
    from app.services.followup import FollowupService

    try:
        elder_id = int(args.get("elder_id"))
    except (TypeError, ValueError):
        return ToolResult.fail("elder_id 必填且必须是整数", bubble="followup_list")
    plan_type = (args.get("plan_type") or "").strip()
    if not plan_type:
        return ToolResult.fail("plan_type 不能为空", bubble="followup_list")
    planned_at = _parse_dt(args.get("planned_at"))
    if planned_at is None:
        return ToolResult.fail("planned_at 必填，格式 ISO8601", bubble="followup_list")
    assigned_to = args.get("assigned_to")
    notes = (args.get("notes") or "").strip() or None
    idempotency_key = (args.get("idempotency_key") or "").strip() or None

    # Idempotency via notes marker: we embed `[idem:KEY]` in the notes
    # and check for an existing non-deleted followup containing that marker.
    if idempotency_key:
        marker = f"[idem:{idempotency_key}]"
        stmt = (
            select(Followup)
            .where(
                Followup.deleted_at.is_(None),
                Followup.elder_id == elder_id,
                Followup.notes.like(f"%{marker}%"),
            )
            .limit(1)
        )
        existing = (await ctx.db.execute(stmt)).scalar_one_or_none()
        if existing is not None:
            ename = (
                await ctx.db.execute(select(Elder.name).where(Elder.id == existing.elder_id))
            ).scalar_one_or_none()
            data = _fu_to_dict(existing, ename, None)
            data["idempotent"] = True
            return ToolResult(
                ok=True,
                model_text=f"已存在相同 idempotency_key 的随访计划 #{existing.id}，未重复创建。",
                ui_payload=data,
                ui_bubble_type="followup_list",
            )
        notes = (notes + " " if notes else "") + marker

    payload: Dict[str, Any] = {
        "elder_id": elder_id,
        "plan_type": plan_type,
        "planned_at": planned_at,
        "status": "todo",
        "notes": notes,
    }
    if assigned_to is not None:
        try:
            payload["assigned_to"] = int(assigned_to)
        except (TypeError, ValueError):
            pass
    else:
        # Default the assignee to the calling doctor
        if ctx.role_code == "doctor":
            payload["assigned_to"] = ctx.current_user.id

    try:
        resp = await FollowupService.create(ctx.db, payload)
    except Exception as e:  # noqa: BLE001
        return ToolResult.fail(f"创建随访失败: {e}", bubble="followup_list")
    data = {
        "id": resp.id,
        "elder_id": resp.elder_id,
        "elder_name": resp.elder_name,
        "plan_type": resp.plan_type,
        "planned_at": resp.planned_at.isoformat() if resp.planned_at else None,
        "status": resp.status,
        "assigned_to": resp.assigned_to,
        "assigned_to_name": resp.assigned_to_name,
        "notes": resp.notes,
        "records_count": 0,
        "idempotent": False,
    }
    return ToolResult(
        ok=True,
        model_text=(
            f"随访计划已创建 #{resp.id}：{resp.elder_name or resp.elder_id}，"
            f"类型={resp.plan_type}，计划 {data['planned_at']}，"
            f"负责：{resp.assigned_to_name or '未指定'}。"
        ),
        ui_payload=data,
        ui_bubble_type="followup_list",
    )


register(
    ToolSpec(
        name="create_followup",
        description=(
            "Create a follow-up plan for an elder. "
            "Pass idempotency_key to deduplicate retries within the same elder's plans."
        ),
        parameters={
            "type": "object",
            "properties": {
                "elder_id": {"type": "integer"},
                "plan_type": {"type": "string"},
                "planned_at": {"type": "string", "description": "ISO8601 datetime"},
                "assigned_to": {"type": "integer", "description": "doctor user_id; defaults to caller"},
                "notes": {"type": "string"},
                "idempotency_key": {"type": "string"},
            },
            "required": ["elder_id", "plan_type", "planned_at"],
        },
        handler=_handle_create_followup,
        allowed_roles={"doctor"},
        required_permission="followup:create",
        action="write",
        ui_bubble_type="followup_list",
    )
)


# --------------------------------------------------------------------- add_followup_record


async def _handle_add_followup_record(args: dict, ctx: ToolContext) -> ToolResult:
    from app.services.followup import FollowupService

    try:
        followup_id = int(args.get("followup_id"))
    except (TypeError, ValueError):
        return ToolResult.fail("followup_id 必填且必须是整数", bubble="text")
    actual_time = _parse_dt(args.get("actual_time"))
    if actual_time is None:
        return ToolResult.fail("actual_time 必填（ISO8601）", bubble="text")
    result_text = (args.get("result") or "").strip()
    if not result_text:
        return ToolResult.fail("result 不能为空", bubble="text")
    next_action = (args.get("next_action") or "").strip() or None

    # Idempotency: (followup_id, actual_time) already has a record -> return it
    stmt = (
        select(FollowupRecord)
        .where(
            FollowupRecord.followup_id == followup_id,
            FollowupRecord.actual_time == actual_time,
            FollowupRecord.deleted_at.is_(None),
        )
        .limit(1)
    )
    existing = (await ctx.db.execute(stmt)).scalar_one_or_none()
    if existing is not None:
        return ToolResult(
            ok=True,
            model_text=(
                f"该随访 #{followup_id} 在 {actual_time.isoformat()} 的记录已存在，"
                f"未重复创建（幂等）。"
            ),
            ui_payload={
                "id": existing.id,
                "followup_id": followup_id,
                "actual_time": existing.actual_time.isoformat() if existing.actual_time else None,
                "result": existing.result,
                "next_action": existing.next_action,
                "status": existing.status,
                "idempotent": True,
            },
            ui_bubble_type="text",
        )

    payload: Dict[str, Any] = {
        "actual_time": actual_time,
        "result": result_text,
        "next_action": next_action,
        "status": "completed",
    }
    try:
        resp = await FollowupService.add_record(ctx.db, followup_id, payload)
    except Exception as e:  # noqa: BLE001
        return ToolResult.fail(f"添加随访记录失败: {e}", bubble="text")
    if resp is None:
        return ToolResult.fail(f"未找到随访计划 #{followup_id}", bubble="text")
    data = {
        "id": resp.id,
        "followup_id": followup_id,
        "actual_time": resp.actual_time.isoformat() if resp.actual_time else None,
        "result": resp.result,
        "next_action": resp.next_action,
        "status": resp.status,
        "idempotent": False,
    }
    return ToolResult(
        ok=True,
        model_text=f"随访记录已登记 #{resp.id}（计划 #{followup_id}），随访状态已更新为 completed。",
        ui_payload=data,
        ui_bubble_type="text",
    )


register(
    ToolSpec(
        name="add_followup_record",
        description=(
            "Add an execution record to a followup plan. "
            "Idempotent on (followup_id, actual_time) — duplicates return the existing row."
        ),
        parameters={
            "type": "object",
            "properties": {
                "followup_id": {"type": "integer"},
                "actual_time": {"type": "string", "description": "ISO8601 datetime"},
                "result": {"type": "string", "minLength": 1},
                "next_action": {"type": "string"},
            },
            "required": ["followup_id", "actual_time", "result"],
        },
        handler=_handle_add_followup_record,
        allowed_roles={"doctor"},
        required_permission="followup:update",
        action="write",
        ui_bubble_type="text",
    )
)
