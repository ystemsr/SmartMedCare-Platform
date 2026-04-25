"""Prediction task pipeline.

Glue layer that, given a PredictionTask row, assembles its feature vector,
runs ML inference, and persists the outcome. Called from two places:

- Doctor creates a task: if inputs are already complete (pre-existing elder
  answers from cached static fields + recent dynamic submissions etc.), run
  inference immediately.
- Elder submits their part: re-check readiness; if complete, run inference.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.prediction_task import PredictionTask
from app.repositories.bigdata import PredictionResultRepository
from app.repositories.prediction_task import (
    EDITABLE_STATUSES,
    PredictionTaskRepository,
    STATUS_FAILED,
    STATUS_PENDING_DOCTOR,
    STATUS_PENDING_ELDER,
    STATUS_PENDING_PREDICTION,
    STATUS_PREDICTED,
)
from app.services import ml_inference
from app.services.feature_catalog import (
    FEATURE_CATALOG,
    assemble_feature_vector,
    missing_required,
)

logger = logging.getLogger(__name__)


def _assemble(task: PredictionTask) -> tuple[dict[str, Any], dict[str, str]]:
    return assemble_feature_vector(
        auto_inputs=task.auto_inputs or {},
        permanent_inputs=task.permanent_inputs or {},
        doctor_inputs=task.doctor_inputs or {},
        elder_inputs=task.elder_inputs or {},
    )


def is_ready(task: PredictionTask) -> bool:
    """Whether the task has all required inputs to run inference."""
    features, _ = _assemble(task)
    return not missing_required(features)


async def run_if_ready(
    db: AsyncSession, task: PredictionTask
) -> PredictionTask:
    """Run inference on the task if inputs are complete; otherwise route the
    task to the side that still needs to act.

    Routing rules:
      - no gaps → run inference, mark predicted
      - any elder-filler gap remains → pending_elder
      - otherwise (only doctor/auto gaps) → pending_doctor
    """
    features, _sources = _assemble(task)
    gaps = missing_required(features)
    if gaps:
        # Terminal-state tasks aren't re-routed.
        if task.status not in EDITABLE_STATUSES:
            return task
        elder_gaps = [
            k for k in gaps if FEATURE_CATALOG.get(k, {}).get("filler") == "elder"
        ]
        new_status = STATUS_PENDING_ELDER if elder_gaps else STATUS_PENDING_DOCTOR
        if task.status != new_status:
            await PredictionTaskRepository.mark_status(db, task, new_status)
        return task

    # All required inputs present — run inference.
    await PredictionTaskRepository.mark_status(
        db, task, STATUS_PENDING_PREDICTION
    )

    try:
        prediction = ml_inference.predict(features)
    except FileNotFoundError as e:
        logger.warning("Prediction task %s: model not found", task.id)
        return await PredictionTaskRepository.mark_status(
            db, task, STATUS_FAILED, error_message=f"模型文件缺失: {e}"
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("Prediction task %s inference failed", task.id)
        return await PredictionTaskRepository.mark_status(
            db, task, STATUS_FAILED, error_message=f"推理失败: {e}"
        )

    result_row = await PredictionResultRepository.upsert_latest(
        db,
        task.elder_id,
        {
            **prediction,
            "predicted_at": datetime.now(timezone.utc),
        },
    )

    return await PredictionTaskRepository.mark_status(
        db,
        task,
        STATUS_PREDICTED,
        features_snapshot=features,
        prediction_result_id=result_row.id,
    )


async def route_or_run_sync(
    db: AsyncSession, task: PredictionTask
) -> tuple[PredictionTask, bool]:
    """Compute readiness and route the task. Does NOT run inference.

    Returns (task, ready). When ready=True the caller is expected to schedule
    inference out-of-band (so the HTTP response can return immediately).
    """
    features, _sources = _assemble(task)
    gaps = missing_required(features)
    if not gaps:
        if task.status != STATUS_PENDING_PREDICTION:
            task = await PredictionTaskRepository.mark_status(
                db, task, STATUS_PENDING_PREDICTION, features_snapshot=features
            )
        return task, True

    if task.status in EDITABLE_STATUSES:
        elder_gaps = [
            k for k in gaps if FEATURE_CATALOG.get(k, {}).get("filler") == "elder"
        ]
        new_status = STATUS_PENDING_ELDER if elder_gaps else STATUS_PENDING_DOCTOR
        if task.status != new_status:
            task = await PredictionTaskRepository.mark_status(db, task, new_status)
    return task, False


async def run_inference_background(task_id: int) -> None:
    """Background worker: run the TorchScript model for a ready task.

    Opens its own DB session since FastAPI BackgroundTasks execute after the
    request lifecycle has ended.
    """
    async with AsyncSessionLocal() as db:
        try:
            task = await PredictionTaskRepository.get_by_id(db, task_id)
            if task is None or task.status != STATUS_PENDING_PREDICTION:
                return

            features, _ = _assemble(task)
            try:
                prediction = ml_inference.predict(features)
            except FileNotFoundError as e:
                logger.warning("Task %s: model not found", task_id)
                await PredictionTaskRepository.mark_status(
                    db, task, STATUS_FAILED, error_message=f"模型文件缺失: {e}"
                )
                await db.commit()
                return
            except Exception as e:  # noqa: BLE001
                logger.exception("Task %s inference failed", task_id)
                await PredictionTaskRepository.mark_status(
                    db, task, STATUS_FAILED, error_message=f"推理失败: {e}"
                )
                await db.commit()
                return

            result_row = await PredictionResultRepository.upsert_latest(
                db,
                task.elder_id,
                {**prediction, "predicted_at": datetime.now(timezone.utc)},
            )
            await PredictionTaskRepository.mark_status(
                db,
                task,
                STATUS_PREDICTED,
                features_snapshot=features,
                prediction_result_id=result_row.id,
            )
            await db.commit()
        except Exception:  # noqa: BLE001
            logger.exception("Background inference session crashed")
            await db.rollback()


async def build_task_result_payload(
    db: AsyncSession, task: PredictionTask
) -> Optional[dict[str, Any]]:
    """Given a `predicted` task, load its PredictionResult row into a dict."""
    if not task.prediction_result_id:
        return None
    from sqlalchemy import select

    from app.models.bigdata import PredictionResult

    row = (
        await db.execute(
            select(PredictionResult).where(
                PredictionResult.id == task.prediction_result_id,
                PredictionResult.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    return {
        "id": row.id,
        "high_risk_prob": float(row.high_risk_prob),
        "high_risk": bool(row.high_risk),
        "followup_prob": float(row.followup_prob),
        "followup_needed": bool(row.followup_needed),
        "health_score": float(row.health_score),
        "predicted_at": row.predicted_at.isoformat() if row.predicted_at else None,
    }
