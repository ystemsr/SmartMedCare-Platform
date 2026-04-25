"""Assessment tools: list, detail, feature catalog, and (write) run_health_assessment.

Write tool uses natural idempotency: at most one assessment per
(elder_id, assessment_type, DATE(created_at)) — if a row already exists
today for the same key, we return the existing row (opportunistic read),
explicitly noting so in model_text. This is safer than blindly UPDATE-
ing a scoring record.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select

from app.models.assessment import Assessment
from app.models.elder import Elder
from app.services.ai_tools._common import cap_model_lines, strip_heavy
from app.services.ai_tools.context import ToolContext, ToolResult
from app.services.ai_tools.registry import ToolSpec, register


def _parse_date(v: Any) -> Optional[datetime]:
    if not v:
        return None
    try:
        return datetime.fromisoformat(str(v))
    except ValueError:
        return None


async def _elder_name(ctx: ToolContext, eid: int) -> Optional[str]:
    row = (
        await ctx.db.execute(select(Elder.name).where(Elder.id == eid))
    ).scalar_one_or_none()
    return row


def _assess_to_dict(a: Assessment, elder_name: Optional[str]) -> Dict[str, Any]:
    return {
        "id": a.id,
        "elder_id": a.elder_id,
        "elder_name": elder_name,
        "assessment_type": a.assessment_type,
        "score": a.score,
        "risk_level": a.risk_level,
        "summary": a.summary,
        "suggestions": a.suggestions or [],
        "feature_inputs": a.feature_inputs,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "created_by": a.created_by,
    }


# --------------------------------------------------------------------- list_assessments


async def _handle_list_assessments(args: dict, ctx: ToolContext) -> ToolResult:
    page = max(1, int(args.get("page") or 1))
    page_size = max(1, min(50, int(args.get("page_size") or 20)))
    stmt = select(Assessment).where(Assessment.deleted_at.is_(None))

    eid = args.get("elder_id")
    if eid is not None:
        eid_int = int(eid)
        ctx.enforce_elder_scope(eid_int)
        stmt = stmt.where(Assessment.elder_id == eid_int)
    elif ctx.scoped_elder_ids is not None:
        if not ctx.scoped_elder_ids:
            return ToolResult(
                ok=True,
                model_text="尚未关联任何老人档案。",
                ui_payload={"total": 0, "page": page, "page_size": page_size, "items": []},
                ui_bubble_type="table",
            )
        stmt = stmt.where(Assessment.elder_id.in_(ctx.scoped_elder_ids))

    at = args.get("assessment_type")
    if at:
        stmt = stmt.where(Assessment.assessment_type == str(at))
    rl = args.get("risk_level")
    if rl in ("low", "medium", "high"):
        stmt = stmt.where(Assessment.risk_level == rl)
    df = _parse_date(args.get("date_from"))
    dt = _parse_date(args.get("date_to"))
    if df:
        stmt = stmt.where(Assessment.created_at >= df)
    if dt:
        stmt = stmt.where(Assessment.created_at <= dt)

    total = (await ctx.db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    stmt = (
        stmt.order_by(Assessment.created_at.desc(), Assessment.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await ctx.db.execute(stmt)).scalars().all()

    # Batch resolve elder names
    eids = list({r.elder_id for r in rows})
    name_map: Dict[int, str] = {}
    if eids:
        nrows = (
            await ctx.db.execute(select(Elder.id, Elder.name).where(Elder.id.in_(eids)))
        ).all()
        name_map = {r[0]: r[1] for r in nrows}
    # feature_inputs can be a huge JSON blob (the 20-feature snapshot);
    # drop it from list items — callers who need it should follow up
    # with get_assessment_detail(id). This keeps both model_text and
    # ui_payload lean.
    items = strip_heavy(
        [_assess_to_dict(r, name_map.get(r.elder_id)) for r in rows],
        keys=["feature_inputs"],
    )

    if not items:
        return ToolResult(
            ok=True,
            model_text="未找到评估记录。",
            ui_payload={"total": 0, "page": page, "page_size": page_size, "items": []},
            ui_bubble_type="table",
        )
    header = f"共 {total} 条评估（第 {page} 页）："
    body: List[str] = []
    for it in items:
        ts = (it["created_at"] or "")[:10]
        body.append(
            f"- [ID {it['id']}] {it['elder_name'] or it['elder_id']} | {it['assessment_type']} | "
            f"得分={it['score']} | 风险={it['risk_level']} | {ts}"
        )
    return ToolResult(
        ok=True,
        model_text=cap_model_lines(header, body, total),
        ui_payload={"total": total, "page": page, "page_size": page_size, "items": items},
        ui_bubble_type="table",
    )


register(
    ToolSpec(
        name="list_assessments",
        description="List health assessments with filters (elder, type, risk level, date range).",
        parameters={
            "type": "object",
            "properties": {
                "elder_id": {"type": "integer"},
                "assessment_type": {"type": "string"},
                "risk_level": {"type": "string", "enum": ["low", "medium", "high"]},
                "date_from": {"type": "string"},
                "date_to": {"type": "string"},
                "page": {"type": "integer", "minimum": 1, "default": 1},
                "page_size": {"type": "integer", "minimum": 1, "maximum": 30, "default": 10},
            },
        },
        handler=_handle_list_assessments,
        allowed_roles={"admin", "doctor", "elder", "family"},
        # No required_permission: admin/doctor carry `assessment:read`
        # anyway; elder/family don't but they're fully scope-restricted
        # to their own/linked elder via ToolContext.scoped_elder_ids.
        action="read",
        ui_bubble_type="table",
    )
)


# --------------------------------------------------------------------- get_assessment_detail


async def _handle_get_assessment_detail(args: dict, ctx: ToolContext) -> ToolResult:
    try:
        aid = int(args.get("assessment_id"))
    except (TypeError, ValueError):
        return ToolResult.fail("assessment_id 必填且必须是整数", bubble="assessment")
    row = (
        await ctx.db.execute(
            select(Assessment).where(Assessment.id == aid, Assessment.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if row is None:
        return ToolResult.fail(f"未找到评估 #{aid}", bubble="assessment")
    ctx.enforce_elder_scope(row.elder_id)
    name = await _elder_name(ctx, row.elder_id)
    data = _assess_to_dict(row, name)
    suggestions = data.get("suggestions") or []
    top_sug = "\n".join(f"  • {s}" for s in suggestions[:3])
    model_text = (
        f"评估 #{data['id']}：{data['elder_name'] or data['elder_id']}\n"
        f"类型：{data['assessment_type']} | 得分：{data['score']} | 风险：{data['risk_level']}\n"
        f"摘要：{data['summary'] or '（无）'}\n"
        + (f"建议：\n{top_sug}" if top_sug else "")
    )
    return ToolResult(ok=True, model_text=model_text, ui_payload=data, ui_bubble_type="assessment")


register(
    ToolSpec(
        name="get_assessment_detail",
        description="Return a single assessment's full detail including summary and suggestions.",
        parameters={
            "type": "object",
            "properties": {"assessment_id": {"type": "integer"}},
            "required": ["assessment_id"],
        },
        handler=_handle_get_assessment_detail,
        allowed_roles={"admin", "doctor", "elder", "family"},
        # Scope-restricted via enforce_elder_scope in the handler;
        # elder/family seeds don't carry `assessment:read`.
        action="read",
        ui_bubble_type="assessment",
    )
)


# --------------------------------------------------------------------- get_assessment_feature_catalog


async def _handle_get_feature_catalog(args: dict, ctx: ToolContext) -> ToolResult:
    from app.services.feature_catalog import public_catalog

    features = public_catalog()
    lines = [f"评估特征目录，共 {len(features)} 项："]
    for f in features[:20]:
        key = f.get("key")
        label = f.get("label") or key
        required = "必填" if f.get("required") else "选填"
        lines.append(f"- {key}：{label}（{required}）")
    if len(features) > 20:
        lines.append(f"... 另有 {len(features) - 20} 项，详见结构化返回。")
    return ToolResult(
        ok=True,
        model_text="\n".join(lines),
        ui_payload={"features": features},
        ui_bubble_type="table",
    )


register(
    ToolSpec(
        name="get_assessment_feature_catalog",
        description="Return the 20-feature catalog used by run_health_assessment (for building the input form).",
        parameters={"type": "object", "properties": {}},
        handler=_handle_get_feature_catalog,
        allowed_roles={"admin", "doctor"},
        required_permission="assessment:create",
        action="read",
        ui_bubble_type="table",
    )
)


# --------------------------------------------------------------------- run_health_assessment


async def _handle_run_health_assessment(args: dict, ctx: ToolContext) -> ToolResult:
    from app.schemas.assessment import AssessmentCreate
    from app.services.assessment import AssessmentService

    try:
        elder_id = int(args.get("elder_id"))
    except (TypeError, ValueError):
        return ToolResult.fail("elder_id 必填且必须是整数", bubble="assessment")
    assessment_type = str(args.get("assessment_type") or "comprehensive").strip() or "comprehensive"
    features = args.get("features")
    if features is None:
        features = {}
    if not isinstance(features, dict):
        return ToolResult.fail("features 必须是对象 (key->value)", bubble="assessment")

    # Natural idempotency: same elder + type + today -> return existing
    today = datetime.combine(date.today(), datetime.min.time())
    tomorrow = today + timedelta(days=1)
    existing = (
        await ctx.db.execute(
            select(Assessment)
            .where(
                Assessment.elder_id == elder_id,
                Assessment.assessment_type == assessment_type,
                Assessment.deleted_at.is_(None),
                Assessment.created_at >= today,
                Assessment.created_at < tomorrow,
            )
            .order_by(Assessment.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if existing is not None:
        name = await _elder_name(ctx, existing.elder_id)
        data = _assess_to_dict(existing, name)
        data["idempotent"] = True
        return ToolResult(
            ok=True,
            model_text=(
                f"{name or elder_id} 今日已存在 {assessment_type} 评估 (#{existing.id})，"
                f"得分 {existing.score}，风险 {existing.risk_level}。未重复创建（幂等）。"
            ),
            ui_payload=data,
            ui_bubble_type="assessment",
        )

    try:
        resp = await AssessmentService.create_assessment(
            ctx.db,
            AssessmentCreate(
                elder_id=elder_id,
                assessment_type=assessment_type,
                feature_inputs=features,
            ),
            created_by=ctx.current_user.id,
        )
    except ValueError as e:
        return ToolResult.fail(str(e), bubble="assessment")
    except Exception as e:  # noqa: BLE001
        return ToolResult.fail(f"评估失败: {e}", bubble="assessment")

    data = {
        "id": resp.id,
        "elder_id": resp.elder_id,
        "elder_name": resp.elder_name,
        "assessment_type": resp.assessment_type,
        "score": resp.score,
        "risk_level": resp.risk_level,
        "summary": resp.summary,
        "suggestions": resp.suggestions or [],
        "feature_inputs": resp.feature_inputs,
        "created_at": resp.created_at.isoformat() if resp.created_at else None,
        "idempotent": False,
    }
    top_sug = "\n".join(f"  • {s}" for s in (resp.suggestions or [])[:3])
    model_text = (
        f"评估完成（#{resp.id}）：{resp.elder_name or resp.elder_id} {resp.assessment_type}，"
        f"得分 {resp.score}，风险 {resp.risk_level}。\n"
        f"摘要：{resp.summary or '（无）'}\n"
        + (f"建议：\n{top_sug}" if top_sug else "")
    )
    return ToolResult(ok=True, model_text=model_text, ui_payload=data, ui_bubble_type="assessment")


register(
    ToolSpec(
        name="run_health_assessment",
        description=(
            "Run the 20-feature ML health assessment for an elder and persist it. "
            "Idempotent per (elder_id, assessment_type, today) — same-day repeats return the existing record."
        ),
        parameters={
            "type": "object",
            "properties": {
                "elder_id": {"type": "integer"},
                "assessment_type": {
                    "type": "string",
                    "description": "defaults to 'comprehensive'",
                },
                "features": {
                    "type": "object",
                    "description": "Map of feature_key -> value. See get_assessment_feature_catalog.",
                    "additionalProperties": True,
                },
            },
            "required": ["elder_id", "features"],
        },
        handler=_handle_run_health_assessment,
        allowed_roles={"doctor"},
        required_permission="assessment:create",
        action="write",
        ui_bubble_type="assessment",
    )
)
