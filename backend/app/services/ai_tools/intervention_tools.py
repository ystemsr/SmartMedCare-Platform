"""Intervention tools: list + idempotent create."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select

from app.models.elder import Elder
from app.models.intervention import Intervention
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


def _iv_to_dict(
    iv: Intervention, elder_name: Optional[str], performer_name: Optional[str]
) -> Dict[str, Any]:
    return {
        "id": iv.id,
        "elder_id": iv.elder_id,
        "elder_name": elder_name,
        "followup_id": iv.followup_id,
        "type": iv.type,
        "status": iv.status,
        "content": iv.content,
        "planned_at": iv.planned_at.isoformat() if iv.planned_at else None,
        "performed_by": iv.performed_by,
        "performed_by_name": performer_name,
        "performed_at": iv.performed_at.isoformat() if iv.performed_at else None,
        "result": iv.result,
        "created_at": iv.created_at.isoformat() if iv.created_at else None,
    }


async def _handle_list_interventions(args: dict, ctx: ToolContext) -> ToolResult:
    page = max(1, int(args.get("page") or 1))
    page_size = max(1, min(50, int(args.get("page_size") or 20)))
    stmt = select(Intervention).where(Intervention.deleted_at.is_(None))
    eid = args.get("elder_id")
    if eid is not None:
        eid_int = int(eid)
        ctx.enforce_elder_scope(eid_int)
        stmt = stmt.where(Intervention.elder_id == eid_int)

    status = args.get("status")
    if status:
        stmt = stmt.where(Intervention.status == str(status))
    type_ = args.get("type")
    if type_:
        stmt = stmt.where(Intervention.type == str(type_))
    df = _parse_dt(args.get("date_from"))
    dt_ = _parse_dt(args.get("date_to"))
    if df:
        stmt = stmt.where(Intervention.planned_at >= df)
    if dt_:
        stmt = stmt.where(Intervention.planned_at <= dt_)

    # Doctor-only: restrict to interventions performed by / planned for their patients
    role_names = {ur.role.name for ur in (ctx.current_user.user_roles or []) if ur.role}
    if ctx.role_code == "doctor" and "admin" not in role_names:
        stmt = stmt.where(
            (Intervention.performed_by == ctx.current_user.id)
            | (Intervention.performed_by.is_(None))
        )

    total = (await ctx.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    stmt = (
        stmt.order_by(Intervention.planned_at.desc(), Intervention.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await ctx.db.execute(stmt)).scalars().all()

    eids = list({r.elder_id for r in rows})
    pids = list({r.performed_by for r in rows if r.performed_by is not None})
    name_map: Dict[int, str] = {}
    if eids:
        rr = (await ctx.db.execute(select(Elder.id, Elder.name).where(Elder.id.in_(eids)))).all()
        name_map = {r[0]: r[1] for r in rr}
    user_map: Dict[int, str] = {}
    if pids:
        rr = (
            await ctx.db.execute(
                select(User.id, User.real_name, User.username).where(User.id.in_(pids))
            )
        ).all()
        user_map = {r[0]: (r[1] or r[2]) for r in rr}
    items = [
        _iv_to_dict(r, name_map.get(r.elder_id), user_map.get(r.performed_by or 0))
        for r in rows
    ]

    if not items:
        return ToolResult(
            ok=True,
            model_text="暂无干预记录。",
            ui_payload={"total": 0, "page": page, "page_size": page_size, "items": []},
            ui_bubble_type="intervention_list",
        )
    header = f"共 {total} 条干预记录（第 {page} 页）："
    body: List[str] = []
    for it in items:
        ts = (it["planned_at"] or "")[:16].replace("T", " ") or "未定时间"
        body.append(
            f"- [ID {it['id']}] {it['elder_name'] or it['elder_id']} | {it['type']} | "
            f"状态={it['status']} | {ts}"
        )
    return ToolResult(
        ok=True,
        model_text=cap_model_lines(header, body, total),
        ui_payload={"total": total, "page": page, "page_size": page_size, "items": items},
        ui_bubble_type="intervention_list",
    )


register(
    ToolSpec(
        name="list_interventions",
        description="List intervention records with filters. Doctor callers see their own / unassigned interventions.",
        parameters={
            "type": "object",
            "properties": {
                "elder_id": {"type": "integer"},
                "status": {"type": "string"},
                "type": {"type": "string"},
                "date_from": {"type": "string"},
                "date_to": {"type": "string"},
                "page": {"type": "integer", "minimum": 1, "default": 1},
                "page_size": {"type": "integer", "minimum": 1, "maximum": 30, "default": 10},
            },
        },
        handler=_handle_list_interventions,
        allowed_roles={"admin", "doctor"},
        required_permission="intervention:create",
        action="read",
        ui_bubble_type="intervention_list",
    )
)


# --------------------------------------------------------------------- create_intervention


async def _handle_create_intervention(args: dict, ctx: ToolContext) -> ToolResult:
    from app.services.intervention import InterventionService, InterventionValidationError

    try:
        elder_id = int(args.get("elder_id"))
    except (TypeError, ValueError):
        return ToolResult.fail("elder_id 必填且必须是整数", bubble="intervention_list")
    type_ = (args.get("type") or "").strip()
    if not type_:
        return ToolResult.fail("type 不能为空", bubble="intervention_list")
    content = (args.get("content") or "").strip()
    if not content:
        return ToolResult.fail("content 不能为空", bubble="intervention_list")
    planned_at = _parse_dt(args.get("planned_at"))
    idempotency_key = (args.get("idempotency_key") or "").strip() or None

    if idempotency_key:
        marker = f"[idem:{idempotency_key}]"
        stmt = (
            select(Intervention)
            .where(
                Intervention.deleted_at.is_(None),
                Intervention.elder_id == elder_id,
                Intervention.content.like(f"%{marker}%"),
            )
            .limit(1)
        )
        existing = (await ctx.db.execute(stmt)).scalar_one_or_none()
        if existing is not None:
            ename = (
                await ctx.db.execute(select(Elder.name).where(Elder.id == existing.elder_id))
            ).scalar_one_or_none()
            data = _iv_to_dict(existing, ename, None)
            data["idempotent"] = True
            return ToolResult(
                ok=True,
                model_text=(
                    f"已存在相同 idempotency_key 的干预记录 #{existing.id}，未重复创建。"
                ),
                ui_payload=data,
                ui_bubble_type="intervention_list",
            )
        content = f"{content} {marker}".strip()

    payload: Dict[str, Any] = {
        "elder_id": elder_id,
        "type": type_,
        "content": content,
        "status": "planned",
    }
    if planned_at is not None:
        payload["planned_at"] = planned_at
    if ctx.role_code == "doctor":
        payload["performed_by"] = ctx.current_user.id

    try:
        resp = await InterventionService.create(ctx.db, payload)
    except InterventionValidationError as e:
        return ToolResult.fail(str(e), bubble="intervention_list")
    except Exception as e:  # noqa: BLE001
        return ToolResult.fail(f"创建干预记录失败: {e}", bubble="intervention_list")

    data = {
        "id": resp.id,
        "elder_id": resp.elder_id,
        "elder_name": getattr(resp, "elder_name", None),
        "followup_id": getattr(resp, "followup_id", None),
        "type": resp.type,
        "status": resp.status,
        "content": resp.content,
        "planned_at": resp.planned_at.isoformat() if resp.planned_at else None,
        "performed_by": getattr(resp, "performed_by", None),
        "performed_by_name": getattr(resp, "performed_by_name", None),
        "performed_at": resp.performed_at.isoformat() if getattr(resp, "performed_at", None) else None,
        "result": getattr(resp, "result", None),
        "idempotent": False,
    }
    return ToolResult(
        ok=True,
        model_text=(
            f"干预记录已创建 #{resp.id}：{data['elder_name'] or resp.elder_id}，"
            f"类型={resp.type}，内容：{resp.content[:60]}"
        ),
        ui_payload=data,
        ui_bubble_type="intervention_list",
    )


register(
    ToolSpec(
        name="create_intervention",
        description=(
            "Create an intervention record. "
            "Pass idempotency_key to dedupe retries within the same elder."
        ),
        parameters={
            "type": "object",
            "properties": {
                "elder_id": {"type": "integer"},
                "type": {"type": "string"},
                "content": {"type": "string", "minLength": 1},
                "planned_at": {"type": "string"},
                "idempotency_key": {"type": "string"},
            },
            "required": ["elder_id", "type", "content"],
        },
        handler=_handle_create_intervention,
        allowed_roles={"doctor"},
        required_permission="intervention:create",
        action="write",
        ui_bubble_type="intervention_list",
    )
)
