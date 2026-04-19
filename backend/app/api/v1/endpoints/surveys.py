"""Survey task endpoints — doctor dispatches questionnaires, elders submit answers."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_permission
from app.models.elder import Elder
from app.models.survey_task import SurveyTask
from app.repositories.survey_task import SurveyTaskRepository
from app.schemas.survey_task import (
    SurveyTaskCreate,
    SurveyTaskResponse,
    SurveyTaskSubmit,
)
from app.services.feature_catalog import FEATURE_CATALOG, public_catalog
from app.utils.response import (
    FORBIDDEN,
    NOT_FOUND,
    PARAM_ERROR,
    error_response,
    success_response,
)

logger = logging.getLogger(__name__)
router = APIRouter()


async def _serialize(db: AsyncSession, tasks: list[SurveyTask]) -> list[dict]:
    names = await SurveyTaskRepository.enrich_names(db, tasks)
    out = []
    for t in tasks:
        row = SurveyTaskResponse.model_validate(t).model_dump(mode="json")
        row["elder_name"] = names["elder"].get(t.elder_id)
        row["doctor_name"] = names["doctor"].get(t.doctor_user_id)
        out.append(row)
    return out


async def _get_current_elder(db: AsyncSession, user) -> Optional[Elder]:
    return (
        await db.execute(
            select(Elder).where(
                Elder.user_id == user.id, Elder.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()


@router.post("")
async def create_survey(
    body: SurveyTaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("survey:dispatch")),
):
    """Doctor dispatches a survey questionnaire to an elder."""
    unknown = [f for f in body.requested_fields if f not in FEATURE_CATALOG]
    if unknown:
        return error_response(PARAM_ERROR, f"Unknown requested_fields: {unknown}")

    task = await SurveyTaskRepository.create(
        db,
        elder_id=body.elder_id,
        doctor_user_id=current_user.id,
        requested_fields=body.requested_fields,
        title=body.title,
        message=body.message,
        due_at=body.due_at,
    )
    rows = await _serialize(db, [task])
    return success_response(data=rows[0])


@router.get("")
async def list_surveys(
    elder_id: Optional[int] = Query(None, ge=1),
    status: Optional[str] = Query(None, pattern="^(pending|submitted|cancelled)$"),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("survey:read")),
):
    """Doctor-side list of dispatched surveys (filter by elder/status)."""
    tasks = await SurveyTaskRepository.list_for_doctor(
        db, elder_id=elder_id, status=status, limit=limit
    )
    rows = await _serialize(db, tasks)
    return success_response(data={"items": rows, "total": len(rows)})


@router.get("/my")
async def list_my_surveys(
    status: Optional[str] = Query(None, pattern="^(pending|submitted|cancelled)$"),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Elder lists surveys dispatched to them."""
    elder = await _get_current_elder(db, current_user)
    if elder is None:
        return error_response(FORBIDDEN, "Current account is not linked to an elder profile")

    tasks = await SurveyTaskRepository.list_for_elder(
        db, elder.id, status=status, limit=limit
    )
    rows = await _serialize(db, tasks)
    return success_response(data={"items": rows, "total": len(rows)})


@router.get("/catalog")
async def get_feature_catalog(
    _user=Depends(get_current_user),
):
    """Return the feature catalog metadata (for building dispatch/submit forms)."""
    return success_response(data={"items": public_catalog()})


@router.get("/{task_id}")
async def get_survey(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Fetch a single survey task. Accessible to its elder or to a user with survey:read."""
    task = await SurveyTaskRepository.get_by_id(db, task_id)
    if task is None:
        return error_response(NOT_FOUND, "Survey not found")

    elder = await _get_current_elder(db, current_user)
    owns = elder is not None and elder.id == task.elder_id

    if not owns:
        perms = {
            rp.permission.code
            for ur in current_user.user_roles
            for rp in ur.role.role_permissions
        }
        if "survey:read" not in perms:
            return error_response(FORBIDDEN, "No access to this survey")

    rows = await _serialize(db, [task])
    return success_response(data=rows[0])


@router.post("/{task_id}/submit")
async def submit_survey(
    task_id: int,
    body: SurveyTaskSubmit,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Elder submits answers for a survey task."""
    task = await SurveyTaskRepository.get_by_id(db, task_id)
    if task is None:
        return error_response(NOT_FOUND, "Survey not found")
    if task.status != "pending":
        return error_response(PARAM_ERROR, "Survey is not pending")

    elder = await _get_current_elder(db, current_user)
    if elder is None or elder.id != task.elder_id:
        return error_response(FORBIDDEN, "You may only submit your own surveys")

    cleaned: dict = {}
    for k, v in body.responses.items():
        if k not in task.requested_fields:
            continue
        if v is None or v == "":
            continue
        try:
            cleaned[k] = float(v)
        except (TypeError, ValueError):
            cleaned[k] = v

    if not cleaned:
        return error_response(PARAM_ERROR, "No valid responses provided")

    task = await SurveyTaskRepository.submit(db, task, cleaned)
    rows = await _serialize(db, [task])
    return success_response(data=rows[0])


@router.post("/{task_id}/cancel")
async def cancel_survey(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("survey:dispatch")),
):
    """Cancel a pending survey (dispatcher only)."""
    task = await SurveyTaskRepository.get_by_id(db, task_id)
    if task is None:
        return error_response(NOT_FOUND, "Survey not found")
    if task.doctor_user_id != current_user.id:
        return error_response(FORBIDDEN, "Only the dispatcher may cancel")
    if task.status != "pending":
        return error_response(PARAM_ERROR, "Survey is not cancellable")
    task = await SurveyTaskRepository.cancel(db, task)
    rows = await _serialize(db, [task])
    return success_response(data=rows[0])
