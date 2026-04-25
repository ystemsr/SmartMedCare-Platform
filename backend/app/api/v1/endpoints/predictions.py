"""Prediction task endpoints.

Each ML evaluation is modelled as a PredictionTask. A doctor creates a
task with their doctor-filled inputs. The elder later fills dynamic +
(optionally) static fields through the same elder portal. When required
inputs are complete, inference fires automatically and the result is
linked to the task.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_permission
from app.models.elder import Elder
from app.models.prediction_task import PredictionTask
from app.repositories.prediction_task import (
    EDITABLE_STATUSES,
    OPEN_STATUSES,
    PredictionTaskRepository,
    STATUS_CANCELLED,
    STATUS_PENDING_DOCTOR,
    STATUS_PENDING_ELDER,
    STATUS_PREDICTED,
)
from app.schemas.prediction_task import (
    InputsPreview,
    PredictionTaskBatchCreate,
    PredictionTaskCreate,
    PredictionTaskDoctorUpdate,
    PredictionTaskElderSubmit,
    PredictionTaskResponse,
    PredictionTaskWithResult,
)
from app.services.feature_catalog import (
    AUTO_KEYS,
    DOCTOR_KEYS,
    ELDER_KEYS,
    FEATURE_CATALOG,
    STATIC_KEYS,
    assemble_feature_vector,
    build_auto_inputs,
    build_permanent_cached,
    estimate_feature_contributions,
    missing_required,
)
from app.services.prediction_pipeline import (
    build_task_result_payload,
    run_if_ready,
)
from app.utils.response import (
    FORBIDDEN,
    NOT_FOUND,
    PARAM_ERROR,
    error_response,
    success_response,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ---- helpers ----


async def _current_elder(db: AsyncSession, user) -> Optional[Elder]:
    return (
        await db.execute(
            select(Elder).where(
                Elder.user_id == user.id, Elder.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()


async def _serialize(
    db: AsyncSession,
    tasks: list[PredictionTask],
    *,
    with_result: bool = False,
) -> list[dict]:
    names = await PredictionTaskRepository.enrich_names(db, tasks)
    rows: list[dict] = []
    for t in tasks:
        base = PredictionTaskResponse.model_validate(t).model_dump(mode="json")
        base["elder_name"] = names["elder"].get(t.elder_id)
        base["doctor_name"] = names["doctor"].get(t.doctor_user_id)
        if with_result:
            prediction = await build_task_result_payload(db, t)
            contributions = (
                estimate_feature_contributions(t.features_snapshot or {}, top_k=3)
                if t.features_snapshot
                else None
            )
            row = PredictionTaskWithResult.model_validate(
                {**base, "prediction": prediction, "contributions": contributions}
            ).model_dump(mode="json")
            rows.append(row)
        else:
            rows.append(base)
    return rows


def _clean_inputs(raw: dict, allowed_keys: set[str]) -> dict:
    """Filter + coerce a user-submitted input payload to known feature keys."""
    out: dict = {}
    if not isinstance(raw, dict):
        return out
    for k, v in raw.items():
        if k not in allowed_keys:
            continue
        if v is None or v == "":
            continue
        try:
            out[k] = float(v)
        except (TypeError, ValueError):
            out[k] = v
    return out


# ---------------------------------------------------------------------------
# Preview (for doctor wizard)
# ---------------------------------------------------------------------------


@router.get("/preview/{elder_id}")
async def preview_inputs(
    elder_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("prediction:dispatch")),
):
    """Summary of which inputs are auto / cached / will be asked from whom.

    Used by the doctor-side task wizard to show:
      - auto_inputs: snapshot of AGE / IS_FEMALE / BMI_CATEGORY
      - permanent_inputs: latest cached RACE / SCHLYRS answers
      - doctor_keys / elder_keys: which keys each side still needs to fill
      - missing_required: required keys still missing after auto+permanent
    """
    elder = (
        await db.execute(
            select(Elder).where(
                Elder.id == elder_id, Elder.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if elder is None:
        return error_response(NOT_FOUND, "Elder not found")

    auto = await build_auto_inputs(db, elder_id)
    permanent = await build_permanent_cached(db, elder_id)
    features, _sources = assemble_feature_vector(
        auto_inputs=auto, permanent_inputs=permanent
    )
    payload = InputsPreview(
        elder_id=elder_id,
        elder_name=elder.name,
        auto_inputs=auto,
        permanent_inputs=permanent,
        doctor_keys=list(DOCTOR_KEYS),
        elder_keys=list(ELDER_KEYS),
        missing_required=missing_required(features),
    )
    return success_response(data=payload.model_dump(mode="json"))


# ---------------------------------------------------------------------------
# Doctor-side — create / list / detail / cancel / batch
# ---------------------------------------------------------------------------


async def _create_task_for(
    db: AsyncSession,
    *,
    doctor_user_id: int,
    body_elder_id: int,
    title: str,
    message: Optional[str],
    doctor_inputs: dict,
    due_at,
) -> Optional[PredictionTask]:
    """Shared create helper. Returns the task or None if elder missing.

    If the task is already ready on creation (cached answers cover the
    elder's side), inference runs synchronously so the response already
    carries the final result and the task never sits in pending_prediction
    waiting on an unreliable background worker.
    """
    elder = (
        await db.execute(
            select(Elder).where(
                Elder.id == body_elder_id, Elder.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if elder is None:
        return None

    auto = await build_auto_inputs(db, body_elder_id)
    permanent = await build_permanent_cached(db, body_elder_id)

    # Dynamic fields are always requested. Static fields are only requested
    # if we don't already have a cached answer.
    elder_requested = [k for k in ELDER_KEYS if k not in permanent]

    task = await PredictionTaskRepository.create(
        db,
        elder_id=body_elder_id,
        doctor_user_id=doctor_user_id,
        title=title or "健康风险评估",
        message=message,
        doctor_inputs=doctor_inputs,
        auto_inputs=auto,
        permanent_inputs=permanent,
        elder_requested_fields=elder_requested,
        due_at=due_at,
    )

    return await run_if_ready(db, task)


@router.post("/tasks")
async def create_prediction_task(
    body: PredictionTaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("prediction:dispatch")),
):
    """Create a single prediction task."""
    doctor_inputs = _clean_inputs(body.doctor_inputs, set(DOCTOR_KEYS))

    task = await _create_task_for(
        db,
        doctor_user_id=current_user.id,
        body_elder_id=body.elder_id,
        title=body.title or "健康风险评估",
        message=body.message,
        doctor_inputs=doctor_inputs,
        due_at=body.due_at,
    )
    if task is None:
        return error_response(NOT_FOUND, "Elder not found")
    rows = await _serialize(db, [task], with_result=True)
    return success_response(data=rows[0])


@router.post("/tasks/batch")
async def batch_create_prediction_tasks(
    body: PredictionTaskBatchCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("prediction:dispatch")),
):
    """Create one prediction task per elder_id with shared doctor_inputs."""
    if not body.elder_ids:
        return error_response(PARAM_ERROR, "elder_ids is empty")
    if len(body.elder_ids) > 50:
        return error_response(PARAM_ERROR, "Batch limit is 50 elders")

    doctor_inputs = _clean_inputs(body.doctor_inputs, set(DOCTOR_KEYS))
    results: list[PredictionTask] = []
    missing: list[int] = []
    for elder_id in body.elder_ids:
        task = await _create_task_for(
            db,
            doctor_user_id=current_user.id,
            body_elder_id=elder_id,
            title=body.title or "健康风险评估",
            message=body.message,
            doctor_inputs=doctor_inputs,
            due_at=body.due_at,
        )
        if task is None:
            missing.append(elder_id)
        else:
            results.append(task)

    rows = await _serialize(db, results, with_result=True)
    return success_response(
        data={
            "items": rows,
            "missing_elder_ids": missing,
            "total": len(rows),
        }
    )


@router.get("/tasks")
async def list_prediction_tasks(
    elder_id: Optional[int] = Query(None, ge=1),
    status: Optional[str] = Query(
        None, description="Comma-separated statuses"
    ),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("prediction:read")),
):
    """List prediction tasks (optionally filtered)."""
    statuses = [s for s in (status or "").split(",") if s] or None
    tasks = await PredictionTaskRepository.list_for_doctor(
        db,
        elder_id=elder_id,
        status=statuses,
        limit=limit,
    )
    rows = await _serialize(db, tasks, with_result=True)
    _ = current_user  # reserved for future per-user filtering
    return success_response(data={"items": rows, "total": len(rows)})


@router.get("/tasks/my")
async def list_my_prediction_tasks(
    status: Optional[str] = Query(
        None, description="Comma-separated statuses"
    ),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Elder-side list of prediction tasks they should fill or have filled."""
    elder = await _current_elder(db, current_user)
    if elder is None:
        return error_response(
            FORBIDDEN, "Current account is not linked to an elder profile"
        )
    statuses = [s for s in (status or "").split(",") if s] or None
    tasks = await PredictionTaskRepository.list_for_elder(
        db, elder.id, status=statuses, limit=limit
    )
    rows = await _serialize(db, tasks, with_result=True)
    return success_response(data={"items": rows, "total": len(rows)})


@router.get("/tasks/{task_id}")
async def get_prediction_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Fetch a single task. Accessible to its elder or users with prediction:read."""
    task = await PredictionTaskRepository.get_by_id(db, task_id)
    if task is None:
        return error_response(NOT_FOUND, "Task not found")

    elder = await _current_elder(db, current_user)
    owns = elder is not None and elder.id == task.elder_id
    if not owns:
        perms = {
            rp.permission.code
            for ur in current_user.user_roles
            for rp in ur.role.role_permissions
        }
        if "prediction:read" not in perms:
            return error_response(FORBIDDEN, "No access to this task")

    rows = await _serialize(db, [task], with_result=True)
    return success_response(data=rows[0])


@router.post("/tasks/{task_id}/doctor_update")
async def update_doctor_inputs(
    task_id: int,
    body: PredictionTaskDoctorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("prediction:dispatch")),
):
    """Allow the creating doctor to revise their inputs while the task is
    still waiting for the elder's answers. If this update makes the task
    ready, inference runs synchronously so the response carries the final
    status."""
    task = await PredictionTaskRepository.get_by_id(db, task_id)
    if task is None:
        return error_response(NOT_FOUND, "Task not found")
    if task.doctor_user_id != current_user.id:
        return error_response(FORBIDDEN, "Only the creator may edit")
    if task.status not in EDITABLE_STATUSES:
        return error_response(
            PARAM_ERROR, "Task is no longer editable by the doctor"
        )

    cleaned = _clean_inputs(body.doctor_inputs, set(DOCTOR_KEYS))
    task.doctor_inputs = cleaned
    await db.flush()
    await db.refresh(task)

    task = await run_if_ready(db, task)
    rows = await _serialize(db, [task], with_result=True)
    return success_response(data=rows[0])


@router.post("/tasks/{task_id}/cancel")
async def cancel_prediction_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("prediction:dispatch")),
):
    """Cancel an open prediction task."""
    task = await PredictionTaskRepository.get_by_id(db, task_id)
    if task is None:
        return error_response(NOT_FOUND, "Task not found")
    if task.doctor_user_id != current_user.id:
        return error_response(FORBIDDEN, "Only the creator may cancel")
    if task.status not in OPEN_STATUSES:
        return error_response(PARAM_ERROR, "Task is not cancellable")
    task = await PredictionTaskRepository.cancel(db, task)
    rows = await _serialize(db, [task], with_result=True)
    return success_response(data=rows[0])


# ---------------------------------------------------------------------------
# Elder-side — submit answers (auto-fires inference when complete)
# ---------------------------------------------------------------------------


@router.post("/tasks/{task_id}/elder_submit")
async def submit_prediction_task(
    task_id: int,
    body: PredictionTaskElderSubmit,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Elder submits their dynamic answers (+ optional static updates).

    When the submission completes the required inputs, inference runs
    synchronously inside this request so the elder sees the final status
    (predicted / failed) on the response and the task never lingers in
    pending_prediction waiting on a background worker.
    """
    task = await PredictionTaskRepository.get_by_id(db, task_id)
    if task is None:
        return error_response(NOT_FOUND, "Task not found")
    if task.status not in EDITABLE_STATUSES:
        return error_response(PARAM_ERROR, "Task is not open for submission")

    elder = await _current_elder(db, current_user)
    if elder is None or elder.id != task.elder_id:
        return error_response(FORBIDDEN, "You may only submit your own tasks")

    # Elder may submit any elder-owned key (dynamic + static). Unknown keys
    # and keys from other fillers are ignored.
    allowed = set(ELDER_KEYS) | set(STATIC_KEYS)
    cleaned = _clean_inputs(body.responses, allowed)

    if not cleaned:
        return error_response(PARAM_ERROR, "No valid responses provided")

    # Preserve prior elder_inputs on this task and merge the new ones
    # (edits / resubmissions are allowed within a single task row).
    merged = dict(task.elder_inputs or {})
    merged.update(cleaned)
    task = await PredictionTaskRepository.save_elder_submission(db, task, merged)

    task = await run_if_ready(db, task)
    rows = await _serialize(db, [task], with_result=True)
    return success_response(data=rows[0])


# ---------------------------------------------------------------------------
# Catalog passthrough (doctor/elder UIs that don't have survey permission)
# ---------------------------------------------------------------------------


@router.get("/catalog")
async def prediction_catalog(
    _user=Depends(get_current_user),
):
    """Return the feature catalog for prediction task forms."""
    from app.services.feature_catalog import public_catalog

    return success_response(data={"items": public_catalog()})


# Re-export statuses for frontend reference.
@router.get("/statuses")
async def list_statuses(_user=Depends(get_current_user)):
    return success_response(
        data={
            "open": list(OPEN_STATUSES),
            "all": [
                STATUS_PENDING_ELDER,
                STATUS_PENDING_DOCTOR,
                "pending_prediction",
                STATUS_PREDICTED,
                "failed",
                STATUS_CANCELLED,
            ],
        }
    )


# Silence unused-import linters.
_ = (AUTO_KEYS, FEATURE_CATALOG)
