"""Elder profile / search tools."""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select

from app.models.analytics import ElderRiskProfile
from app.models.assessment import Assessment
from app.models.elder import Elder
from app.models.family_member import FamilyMember
from app.models.user import User
from app.services.ai_tools._common import cap_model_lines, page_count
from app.services.ai_tools.context import ToolContext, ToolResult
from app.services.ai_tools.registry import ToolSpec, register


def _compute_age(birth: Optional[date]) -> Optional[int]:
    if birth is None:
        return None
    today = date.today()
    years = today.year - birth.year
    if (today.month, today.day) < (birth.month, birth.day):
        years -= 1
    return max(0, years)


def _mask_phone(phone: Optional[str]) -> str:
    if not phone or len(phone) < 7:
        return phone or ""
    return phone[:3] + "****" + phone[-4:]


def _mask_id_card(idc: Optional[str]) -> str:
    if not idc or len(idc) < 8:
        return idc or ""
    return idc[:4] + "********" + idc[-4:]


async def _load_elder(ctx: ToolContext, elder_id: int) -> Optional[Elder]:
    # Elder.tags is already lazy="selectin" on the relationship — no need
    # for an explicit selectinload option.
    stmt = select(Elder).where(Elder.id == elder_id, Elder.deleted_at.is_(None))
    return (await ctx.db.execute(stmt)).scalar_one_or_none()


async def _risk_level_map(ctx: ToolContext, elder_ids: List[int]) -> dict[int, str]:
    """Batch-fetch risk_level from elder_risk_profiles for a set of elder ids."""
    if not elder_ids:
        return {}
    rows = (
        await ctx.db.execute(
            select(ElderRiskProfile.elder_id, ElderRiskProfile.risk_level).where(
                ElderRiskProfile.elder_id.in_(elder_ids),
                ElderRiskProfile.deleted_at.is_(None),
            )
        )
    ).all()
    return {r[0]: r[1] for r in rows}


async def _latest_assessment(ctx: ToolContext, elder_id: int) -> Optional[Assessment]:
    stmt = (
        select(Assessment)
        .where(Assessment.elder_id == elder_id, Assessment.deleted_at.is_(None))
        .order_by(Assessment.created_at.desc())
        .limit(1)
    )
    return (await ctx.db.execute(stmt)).scalar_one_or_none()


async def _elder_to_profile(ctx: ToolContext, elder: Elder) -> Dict[str, Any]:
    age = _compute_age(elder.birth_date)
    # Primary doctor display name
    doctor_name: Optional[str] = None
    if elder.primary_doctor_id:
        row = (
            await ctx.db.execute(
                select(User.real_name, User.username).where(User.id == elder.primary_doctor_id)
            )
        ).first()
        if row:
            doctor_name = row[0] or row[1]
    latest = await _latest_assessment(ctx, elder.id)
    risk_map = await _risk_level_map(ctx, [elder.id])
    return {
        "id": elder.id,
        # `elder_id` is a synonym of `id` — we include both so downstream
        # tools (list_alerts, list_health_records, ...) can pick whichever
        # field they read without extra mapping.
        "elder_id": elder.id,
        "name": elder.name,
        "gender": elder.gender,
        "age": age,
        "birth_date": elder.birth_date.isoformat() if elder.birth_date else None,
        "id_card_masked": _mask_id_card(elder.id_card),
        "phone_masked": _mask_phone(elder.phone),
        "address": elder.address,
        "account_status": elder.account_status,
        "primary_doctor_id": elder.primary_doctor_id,
        "primary_doctor_name": doctor_name,
        "emergency_contact_name": elder.emergency_contact_name,
        "emergency_contact_phone": _mask_phone(elder.emergency_contact_phone),
        "tags": [t.tag_name for t in (elder.tags or [])],
        "risk_level": risk_map.get(elder.id),
        "latest_assessment": (
            None
            if latest is None
            else {
                "id": latest.id,
                "assessment_type": latest.assessment_type,
                "score": latest.score,
                "risk_level": latest.risk_level,
                "summary": latest.summary,
                "created_at": latest.created_at.isoformat()
                if latest.created_at
                else None,
            }
        ),
    }


# --------------------------------------------------------------------- search_elders


async def _handle_search_elders(args: dict, ctx: ToolContext) -> ToolResult:
    name = (args.get("name") or "").strip() or None
    phone = (args.get("phone") or "").strip() or None
    gender = (args.get("gender") or "").strip() or None
    age_min = args.get("age_min")
    age_max = args.get("age_max")
    page = max(1, int(args.get("page") or 1))
    page_size = max(1, min(50, int(args.get("page_size") or 20)))

    stmt = select(Elder).where(Elder.deleted_at.is_(None))
    if name:
        stmt = stmt.where(Elder.name.like(f"%{name}%"))
    if phone:
        stmt = stmt.where(Elder.phone.like(f"%{phone}%"))
    if gender in ("male", "female", "unknown"):
        stmt = stmt.where(Elder.gender == gender)
    # Doctor-only: scope to own patients
    is_doctor_only = (
        ctx.role_code == "doctor"
        and "admin" not in {ur.role.name for ur in (ctx.current_user.user_roles or []) if ur.role}
    )
    if is_doctor_only:
        stmt = stmt.where(Elder.primary_doctor_id == ctx.current_user.id)

    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await ctx.db.execute(total_stmt)).scalar_one()

    stmt = stmt.order_by(Elder.id.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await ctx.db.execute(stmt)).scalars().all()

    # Age filter post-fetch (birth_date in DB, age computed)
    items: List[Dict[str, Any]] = []
    doctor_name_cache: Dict[int, str] = {}

    # Batch resolve doctor names + risk_levels in one trip each
    doctor_ids = {r.primary_doctor_id for r in rows if r.primary_doctor_id}
    if doctor_ids:
        drows = await ctx.db.execute(
            select(User.id, User.real_name, User.username).where(User.id.in_(doctor_ids))
        )
        doctor_name_cache = {r[0]: (r[1] or r[2]) for r in drows.all()}

    risk_map = await _risk_level_map(ctx, [r.id for r in rows])

    for r in rows:
        age = _compute_age(r.birth_date)
        if age_min is not None and (age is None or age < int(age_min)):
            continue
        if age_max is not None and (age is None or age > int(age_max)):
            continue
        items.append(
            {
                "id": r.id,
                "name": r.name,
                "gender": r.gender,
                "age": age,
                "phone_masked": _mask_phone(r.phone),
                "primary_doctor_id": r.primary_doctor_id,
                "primary_doctor_name": doctor_name_cache.get(r.primary_doctor_id or 0),
                "account_status": r.account_status,
                "risk_level": risk_map.get(r.id),
            }
        )

    # Apply risk_level filter post-enrichment (cheaper than a JOIN)
    risk_filter = (args.get("risk_level") or "").strip() or None
    if risk_filter:
        items = [it for it in items if it.get("risk_level") == risk_filter]

    if not items:
        return ToolResult(
            ok=True,
            model_text="未找到符合条件的老人。",
            ui_payload={"total": total, "page": page, "page_size": page_size, "items": []},
            ui_bubble_type="elder_list",
        )

    header = f"找到 {total} 位老人（第 {page} 页，共 {page_count(total, page_size)} 页）："
    body: List[str] = []
    for i, it in enumerate(items, start=1):
        age_txt = f"{it['age']} 岁" if it["age"] is not None else "年龄未知"
        doc = it["primary_doctor_name"] or "未分配"
        risk = f" 风险={it['risk_level']}" if it.get("risk_level") else ""
        body.append(
            f"{i}. [ID {it['id']}] {it['name']}，{it['gender']}，{age_txt}，主管医生：{doc}{risk}"
        )
    return ToolResult(
        ok=True,
        model_text=cap_model_lines(header, body, total),
        ui_payload={"total": total, "page": page, "page_size": page_size, "items": items},
        ui_bubble_type="elder_list",
    )


register(
    ToolSpec(
        name="search_elders",
        description="Search elders by name/phone/gender/age range. Doctor callers see only their own patients.",
        parameters={
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "partial name match"},
                "phone": {"type": "string", "description": "partial phone match"},
                "gender": {"type": "string", "enum": ["male", "female", "unknown"]},
                "age_min": {"type": "integer", "minimum": 0, "maximum": 150},
                "age_max": {"type": "integer", "minimum": 0, "maximum": 150},
                "risk_level": {
                    "type": "string",
                    "enum": ["low", "medium", "high", "critical"],
                    "description": "Filter by risk_level from elder_risk_profiles",
                },
                "page": {"type": "integer", "minimum": 1, "default": 1},
                "page_size": {"type": "integer", "minimum": 1, "maximum": 30, "default": 10},
            },
        },
        handler=_handle_search_elders,
        allowed_roles={"admin", "doctor"},
        required_permission="elder:read",
        action="read",
        ui_bubble_type="elder_list",
    )
)


# --------------------------------------------------------------------- get_elder_profile


async def _handle_get_elder_profile(args: dict, ctx: ToolContext) -> ToolResult:
    try:
        elder_id = int(args.get("elder_id"))
    except (TypeError, ValueError):
        return ToolResult.fail("elder_id 必填且必须是整数", bubble="elder_profile")
    ctx.enforce_elder_scope(elder_id)
    elder = await _load_elder(ctx, elder_id)
    if elder is None:
        return ToolResult.fail(f"未找到 elder_id={elder_id}", bubble="elder_profile")
    profile = await _elder_to_profile(ctx, elder)
    age_txt = f"{profile['age']} 岁" if profile["age"] is not None else "年龄未知"
    latest = profile["latest_assessment"]
    latest_txt = (
        f"最近评估：{latest['assessment_type']} 风险={latest['risk_level']} 得分={latest['score']}"
        if latest
        else "暂无评估记录"
    )
    risk_txt = f"风险档案：{profile['risk_level']}\n" if profile.get("risk_level") else ""
    tags_txt = f"标签：{'、'.join(profile['tags'])}\n" if profile.get("tags") else ""
    model_text = (
        f"[ID {profile['id']}] {profile['name']}（{profile['gender']}，{age_txt}）\n"
        f"主管医生：{profile['primary_doctor_name'] or '未分配'}\n"
        f"电话：{profile['phone_masked']}\n"
        f"地址：{profile['address'] or '未填写'}\n"
        f"{risk_txt}{tags_txt}{latest_txt}"
    )
    return ToolResult(
        ok=True,
        model_text=model_text,
        ui_payload=profile,
        ui_bubble_type="elder_profile",
    )


register(
    ToolSpec(
        name="get_elder_profile",
        description="Return a single elder's full profile (masked PII). Elder/family callers are restricted to their own/linked elder.",
        parameters={
            "type": "object",
            "properties": {
                "elder_id": {"type": "integer", "description": "target elder id"},
            },
            "required": ["elder_id"],
        },
        handler=_handle_get_elder_profile,
        allowed_roles={"admin", "doctor", "elder", "family"},
        action="read",
        ui_bubble_type="elder_profile",
    )
)


# --------------------------------------------------------------------- get_my_elder


async def _handle_get_my_elder(args: dict, ctx: ToolContext) -> ToolResult:
    """Elder: return own profile. Family: return linked elders."""
    if ctx.scoped_elder_ids is None:
        return ToolResult.fail("该工具仅供老人/家属角色使用", bubble="elder_profile")
    if not ctx.scoped_elder_ids:
        return ToolResult.fail(
            "尚未关联任何老人档案。" + ("请先绑定家属邀请码。" if ctx.role_code == "family" else ""),
            bubble="elder_profile",
        )
    profiles: List[Dict[str, Any]] = []
    for eid in ctx.scoped_elder_ids:
        elder = await _load_elder(ctx, eid)
        if elder is None:
            continue
        profiles.append(await _elder_to_profile(ctx, elder))
    if not profiles:
        return ToolResult.fail("未能加载档案，请稍后重试", bubble="elder_profile")
    if len(profiles) == 1:
        p = profiles[0]
        # Add relationship for family callers
        relationship_txt = ""
        if ctx.role_code == "family":
            fr = (
                await ctx.db.execute(
                    select(FamilyMember.relationship).where(
                        FamilyMember.user_id == ctx.current_user.id,
                        FamilyMember.elder_id == p["id"],
                    )
                )
            ).scalar_one_or_none()
            if fr:
                relationship_txt = f"（您与老人的关系：{fr}）"
        age_txt = f"{p['age']} 岁" if p["age"] is not None else "年龄未知"
        model_text = (
            f"{p['name']}（{p['gender']}，{age_txt}）{relationship_txt}\n"
            f"主管医生：{p['primary_doctor_name'] or '未分配'}\n"
            f"电话：{p['phone_masked']}\n"
            f"地址：{p['address'] or '未填写'}"
        )
        return ToolResult(ok=True, model_text=model_text, ui_payload=p, ui_bubble_type="elder_profile")
    # Multiple linked elders (family)
    lines = [f"共关联 {len(profiles)} 位老人："]
    for i, p in enumerate(profiles, start=1):
        age_txt = f"{p['age']} 岁" if p["age"] is not None else "年龄未知"
        lines.append(f"{i}. [ID {p['id']}] {p['name']}（{p['gender']}，{age_txt}）")
    return ToolResult(
        ok=True,
        model_text="\n".join(lines),
        ui_payload={"total": len(profiles), "items": profiles},
        ui_bubble_type="elder_list",
    )


register(
    ToolSpec(
        name="get_my_elder",
        description="For elder/family callers: return the caller's own elder profile (elder) or all linked elder profiles (family).",
        parameters={"type": "object", "properties": {}},
        handler=_handle_get_my_elder,
        allowed_roles={"elder", "family"},
        action="read",
        ui_bubble_type="elder_profile",
    )
)
