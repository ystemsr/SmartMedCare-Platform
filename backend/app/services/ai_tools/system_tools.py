"""Admin-only system tools + elder self-service tools."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select

from app.models.audit_log import AuditLog
from app.models.knowledge_base import KBDocument
from app.models.role import Role
from app.models.user import User, UserRole
from app.services.ai_tools._common import cap_model_lines
from app.services.ai_tools.context import ToolContext, ToolResult
from app.services.ai_tools.registry import ToolSpec, register


def _mask_phone(phone: Optional[str]) -> str:
    if not phone or len(phone) < 7:
        return phone or ""
    return phone[:3] + "****" + phone[-4:]


# --------------------------------------------------------------------- list_users


async def _handle_list_users(args: dict, ctx: ToolContext) -> ToolResult:
    page = max(1, int(args.get("page") or 1))
    page_size = max(1, min(50, int(args.get("page_size") or 20)))
    keyword = (args.get("keyword") or "").strip()
    status = args.get("status")
    role_filter = args.get("role")

    stmt = select(User).where(User.deleted_at.is_(None))
    if keyword:
        stmt = stmt.where(
            (User.username.like(f"%{keyword}%"))
            | (User.real_name.like(f"%{keyword}%"))
            | (User.phone.like(f"%{keyword}%"))
        )
    if status in ("active", "disabled"):
        stmt = stmt.where(User.status == status)
    if role_filter:
        # Join through user_roles and roles
        stmt = (
            stmt.join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(Role.name == str(role_filter))
        )

    total = (await ctx.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    stmt = stmt.order_by(User.id.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await ctx.db.execute(stmt)).scalars().all()

    # Resolve roles per user
    user_ids = [u.id for u in rows]
    role_map: Dict[int, List[str]] = {uid: [] for uid in user_ids}
    if user_ids:
        role_rows = (
            await ctx.db.execute(
                select(UserRole.user_id, Role.name)
                .join(Role, Role.id == UserRole.role_id)
                .where(UserRole.user_id.in_(user_ids))
            )
        ).all()
        for uid, rname in role_rows:
            role_map.setdefault(uid, []).append(rname)

    items = [
        {
            "id": u.id,
            "username": u.username,
            "real_name": u.real_name,
            "phone_masked": _mask_phone(u.phone),
            "email": u.email,
            "status": u.status,
            "roles": role_map.get(u.id, []),
        }
        for u in rows
    ]

    if not items:
        return ToolResult(
            ok=True,
            model_text="未找到匹配用户。",
            ui_payload={"total": 0, "page": page, "page_size": page_size, "items": []},
            ui_bubble_type="table",
        )
    header = f"共 {total} 位用户（第 {page} 页）："
    body: List[str] = []
    for it in items:
        roles = ",".join(it["roles"]) or "无"
        body.append(
            f"- [ID {it['id']}] {it['real_name'] or it['username']} | {it['username']} | "
            f"角色={roles} | 状态={it['status']}"
        )
    return ToolResult(
        ok=True,
        model_text=cap_model_lines(header, body, total),
        ui_payload={"total": total, "page": page, "page_size": page_size, "items": items},
        ui_bubble_type="table",
    )


register(
    ToolSpec(
        name="list_users",
        description="Admin-only. List platform users with optional role / status / keyword filter.",
        parameters={
            "type": "object",
            "properties": {
                "keyword": {"type": "string"},
                "role": {"type": "string", "enum": ["admin", "doctor", "elder", "family"]},
                "status": {"type": "string", "enum": ["active", "disabled"]},
                "page": {"type": "integer", "minimum": 1, "default": 1},
                "page_size": {"type": "integer", "minimum": 1, "maximum": 30, "default": 10},
            },
        },
        handler=_handle_list_users,
        allowed_roles={"admin"},
        required_permission="user:manage",
        action="read",
        ui_bubble_type="table",
    )
)


# --------------------------------------------------------------------- get_recent_audit_logs


async def _handle_recent_audit_logs(args: dict, ctx: ToolContext) -> ToolResult:
    page = max(1, int(args.get("page") or 1))
    page_size = max(1, min(50, int(args.get("page_size") or 20)))
    days = int(args.get("days") or 7)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_naive = cutoff.replace(tzinfo=None)

    stmt = select(AuditLog).where(AuditLog.created_at >= cutoff_naive)
    user_id = args.get("user_id")
    if user_id is not None:
        try:
            stmt = stmt.where(AuditLog.user_id == int(user_id))
        except (TypeError, ValueError):
            pass
    operation = args.get("operation")
    if operation:
        stmt = stmt.where(AuditLog.operation.like(f"%{operation}%"))
    resource_type = args.get("resource_type")
    if resource_type:
        stmt = stmt.where(AuditLog.resource_type == str(resource_type))

    total = (await ctx.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    stmt = stmt.order_by(AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await ctx.db.execute(stmt)).scalars().all()

    uids = list({r.user_id for r in rows if r.user_id is not None})
    user_map: Dict[int, str] = {}
    if uids:
        urows = (
            await ctx.db.execute(
                select(User.id, User.real_name, User.username).where(User.id.in_(uids))
            )
        ).all()
        user_map = {r[0]: (r[1] or r[2]) for r in urows}
    items = [
        {
            "id": r.id,
            "user_id": r.user_id,
            "username": user_map.get(r.user_id or 0) or "—",
            "operation": r.operation,
            "resource_type": r.resource_type,
            "resource_id": r.resource_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]

    if not items:
        return ToolResult(
            ok=True,
            model_text=f"近 {days} 天内无审计日志。",
            ui_payload={"total": 0, "page": page, "page_size": page_size, "items": []},
            ui_bubble_type="table",
        )
    header = f"近 {days} 天审计日志（共 {total} 条，第 {page} 页）："
    body: List[str] = []
    for it in items:
        ts = (it["created_at"] or "")[:16].replace("T", " ")
        body.append(
            f"- [{it['id']}] {ts} | {it['username']} | {it['operation']} | "
            f"{it['resource_type']}#{it['resource_id'] or '—'}"
        )
    return ToolResult(
        ok=True,
        model_text=cap_model_lines(header, body, total),
        ui_payload={"total": total, "page": page, "page_size": page_size, "items": items},
        ui_bubble_type="table",
    )


register(
    ToolSpec(
        name="get_recent_audit_logs",
        description="Admin-only. List recent audit log entries. Default window: 7 days.",
        parameters={
            "type": "object",
            "properties": {
                "user_id": {"type": "integer"},
                "operation": {"type": "string", "description": "partial match"},
                "resource_type": {"type": "string"},
                "days": {"type": "integer", "minimum": 1, "maximum": 90, "default": 7},
                "page": {"type": "integer", "minimum": 1, "default": 1},
                "page_size": {"type": "integer", "minimum": 1, "maximum": 30, "default": 10},
            },
        },
        handler=_handle_recent_audit_logs,
        allowed_roles={"admin"},
        required_permission="system:audit",
        action="read",
        ui_bubble_type="table",
    )
)


# --------------------------------------------------------------------- list_kb_documents


async def _handle_list_kb_documents(args: dict, ctx: ToolContext) -> ToolResult:
    page = max(1, int(args.get("page") or 1))
    page_size = max(1, min(50, int(args.get("page_size") or 20)))

    stmt = select(KBDocument).where(KBDocument.deleted_at.is_(None))
    role_code = args.get("role_code")
    if role_code in ("admin", "doctor", "elder", "family"):
        stmt = stmt.where(KBDocument.role_code == role_code)
    status = args.get("status")
    if status:
        stmt = stmt.where(KBDocument.status == str(status))

    total = (await ctx.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    stmt = stmt.order_by(KBDocument.id.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await ctx.db.execute(stmt)).scalars().all()
    items = [
        {
            "id": r.id,
            "role_code": r.role_code,
            "name": r.name,
            "file_type": r.file_type,
            "status": r.status,
            "chunk_count": r.chunk_count,
            "size": r.size,
            "uploaded_by": r.uploaded_by,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]

    if not items:
        return ToolResult(
            ok=True,
            model_text="暂无知识库文档。",
            ui_payload={"total": 0, "page": page, "page_size": page_size, "items": []},
            ui_bubble_type="table",
        )
    header = f"共 {total} 份知识库文档（第 {page} 页）："
    body: List[str] = [
        f"- [ID {it['id']}] {it['name']} | 角色={it['role_code']} | "
        f"类型={it['file_type']} | 状态={it['status']} | 分片={it['chunk_count']}"
        for it in items
    ]
    return ToolResult(
        ok=True,
        model_text=cap_model_lines(header, body, total),
        ui_payload={"total": total, "page": page, "page_size": page_size, "items": items},
        ui_bubble_type="table",
    )


register(
    ToolSpec(
        name="list_kb_documents",
        description="Admin-only. List knowledge-base documents optionally filtered by role_code / status.",
        parameters={
            "type": "object",
            "properties": {
                "role_code": {"type": "string", "enum": ["admin", "doctor", "elder", "family"]},
                "status": {"type": "string"},
                "page": {"type": "integer", "minimum": 1, "default": 1},
                "page_size": {"type": "integer", "minimum": 1, "maximum": 30, "default": 10},
            },
        },
        handler=_handle_list_kb_documents,
        allowed_roles={"admin"},
        required_permission="system:config",
        action="read",
        ui_bubble_type="table",
    )
)


# --------------------------------------------------------------------- get_family_invite_code


async def _handle_get_invite_code(args: dict, ctx: ToolContext) -> ToolResult:
    from app.services.invite_code import InviteCodeService

    if ctx.role_code != "elder":
        return ToolResult.fail("该工具仅供老人账号使用", bubble="text")
    if not ctx.scoped_elder_ids:
        return ToolResult.fail("未找到关联的老人档案", bubble="text")
    # An elder user has exactly one elder_id in scope
    elder_id = ctx.scoped_elder_ids[0]
    try:
        resp = await InviteCodeService.get_active_code(ctx.db, elder_id)
    except Exception as e:  # noqa: BLE001
        return ToolResult.fail(f"获取邀请码失败: {e}", bubble="text")
    if resp is None:
        return ToolResult.fail("获取邀请码失败", bubble="text")
    expires = resp.expires_at.isoformat() if resp.expires_at else None
    return ToolResult(
        ok=True,
        model_text=(
            f"您的家属邀请码：{resp.code}\n"
            f"可绑定上限 {resp.max_uses} 人，已绑定 {resp.used_count} 人，"
            f"剩余 {resp.remaining_slots} 人可邀请。"
        ),
        ui_payload={
            "code": resp.code,
            "expires_at": expires,
            "max_uses": resp.max_uses,
            "used_count": resp.used_count,
            "remaining_slots": resp.remaining_slots,
        },
        ui_bubble_type="text",
    )


register(
    ToolSpec(
        name="get_family_invite_code",
        description=(
            "Elder-only self-service. Return the elder's permanent family invite code, creating it on "
            "first call. Idempotent — multiple calls return the same code. Reports the live bound-family "
            "count, which decreases when a family member is unbound."
        ),
        parameters={"type": "object", "properties": {}},
        handler=_handle_get_invite_code,
        allowed_roles={"elder"},
        required_permission="elder:invite",
        action="read",
        ui_bubble_type="text",
    )
)
