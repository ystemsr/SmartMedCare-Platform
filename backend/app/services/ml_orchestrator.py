"""ML orchestrator: run prediction and auto-dispatch alerts / followups.

This module closes the business loop: a health record create triggers
inference, and the result automatically materialises as an Alert (when
high-risk) and a Followup (when followup is needed), so operators see
AI-driven items alongside manual ones in the existing workflows.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.repositories.alert import AlertRepository
from app.repositories.bigdata import PredictionResultRepository
from app.repositories.followup import FollowupRepository
from app.services import ml_inference
from app.services.feature_catalog import (
    DOCTOR_KEYS,
    DYNAMIC_KEYS,
    ELDER_KEYS,
    assemble_feature_vector,
    build_auto_inputs,
    build_permanent_cached,
    missing_required,
)

logger = logging.getLogger(__name__)


async def run_and_dispatch(
    session: AsyncSession, elder_id: int, features: dict
) -> dict:
    """Run inference for a single elder and dispatch downstream records.

    Persists a PredictionResult row. When the model flags high risk, an
    Alert with source="ml" is created. When followup is needed, a Followup
    is queued two days out and linked to the alert (if any). All exceptions
    are caught and logged; the caller never sees them.

    Returns a diagnostic dict with the created row IDs (or None each).
    """
    diag: dict = {
        "prediction_id": None,
        "alert_id": None,
        "followup_id": None,
    }
    try:
        result = ml_inference.predict(features)
    except Exception:
        logger.exception("ml_orchestrator: inference failed for elder_id=%s", elder_id)
        return diag

    now = datetime.now(timezone.utc)

    try:
        prediction = await PredictionResultRepository.upsert_latest(
            session,
            elder_id,
            {
                "high_risk_prob": result["high_risk_prob"],
                "high_risk": bool(result["high_risk"]),
                "followup_prob": result["followup_prob"],
                "followup_needed": bool(result["followup_needed"]),
                "health_score": float(result["health_score"]),
                "predicted_at": now,
            },
        )
        diag["prediction_id"] = prediction.id

        alert_id: Optional[int] = None
        if result["high_risk"]:
            alert = await AlertRepository.create(
                session,
                {
                    "elder_id": elder_id,
                    "type": "ml_risk",
                    "title": "AI 高风险预警",
                    "description": f"健康评分 {result['health_score']:.1f}",
                    "risk_level": "high",
                    "status": "pending",
                    "source": "ml",
                    "triggered_at": now,
                },
            )
            alert_id = alert.id
            diag["alert_id"] = alert_id

        if result["followup_needed"]:
            followup = await FollowupRepository.create(
                session,
                {
                    "elder_id": elder_id,
                    "alert_ids": [alert_id] if alert_id is not None else [],
                    "plan_type": "ai_suggested",
                    "planned_at": now + timedelta(days=2),
                    "status": "todo",
                    "assigned_to": None,
                    "notes": f"AI 自动建议随访 (评分 {result['health_score']:.1f})",
                },
            )
            diag["followup_id"] = followup.id

        await session.commit()
    except Exception:
        logger.exception(
            "ml_orchestrator: dispatch failed for elder_id=%s", elder_id
        )
        try:
            await session.rollback()
        except Exception:
            logger.exception("ml_orchestrator: rollback failed")

    return diag


_DOCTOR_DYNAMIC_KEYS = frozenset(DOCTOR_KEYS) & frozenset(DYNAMIC_KEYS)
_ELDER_DYNAMIC_KEYS = frozenset(ELDER_KEYS) & frozenset(DYNAMIC_KEYS)


async def _latest_dynamic_inputs_from_tasks(
    session: AsyncSession, elder_id: int
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Pull the most recent non-null dynamic answers from prior prediction tasks.

    Walks tasks oldest→newest so latest answers win, and keeps the
    doctor/elder split intact so each value flows back into the source
    bucket the model expects.
    """
    from app.models.prediction_task import PredictionTask  # noqa: WPS433

    rows = (
        await session.execute(
            select(PredictionTask)
            .where(
                PredictionTask.elder_id == elder_id,
                PredictionTask.deleted_at.is_(None),
            )
            .order_by(PredictionTask.updated_at.asc())
        )
    ).scalars().all()

    doctor_out: dict[str, Any] = {}
    elder_out: dict[str, Any] = {}
    for task in rows:
        if isinstance(task.doctor_inputs, dict):
            for k, v in task.doctor_inputs.items():
                if k in _DOCTOR_DYNAMIC_KEYS and v not in (None, ""):
                    doctor_out[k] = v
        if isinstance(task.elder_inputs, dict):
            for k, v in task.elder_inputs.items():
                if k in _ELDER_DYNAMIC_KEYS and v not in (None, ""):
                    elder_out[k] = v
    return doctor_out, elder_out


async def _assemble_features_for_health_record(
    session: AsyncSession, elder_id: int, record_snapshot: dict
) -> tuple[dict[str, Any], dict[str, str]]:
    """Build the 20-feature vector for a health-record-triggered inference.

    Reuses the prediction-task pipeline so the doctor/elder split is
    preserved:
      - auto:      AGE / IS_FEMALE from elder profile, plus this record's
                   HEIGHT_CM / WEIGHT_KG (overriding cached values so BMI
                   reflects the freshly recorded vitals).
      - permanent: cached static answers (RACE, SCHLYRS).
      - doctor:    latest doctor-filled dynamic answers (SERIAL7, ADL, ...).
      - elder:     latest elder-filled dynamic answers (SELF_HEALTH,
                   FALL_2YR, HOSPITAL_STAY, ...).
    """
    auto = await build_auto_inputs(session, elder_id)

    height = record_snapshot.get("height_cm")
    if height is not None:
        try:
            auto["HEIGHT_CM"] = float(height)
        except (TypeError, ValueError):
            pass
    weight = record_snapshot.get("weight_kg")
    if weight is not None:
        try:
            auto["WEIGHT_KG"] = float(weight)
        except (TypeError, ValueError):
            pass

    permanent = await build_permanent_cached(session, elder_id)
    doctor_inputs, elder_inputs = await _latest_dynamic_inputs_from_tasks(
        session, elder_id
    )
    return assemble_feature_vector(
        auto_inputs=auto,
        permanent_inputs=permanent,
        doctor_inputs=doctor_inputs,
        elder_inputs=elder_inputs,
    )


async def run_for_health_record(elder_id: int, record_snapshot: dict) -> dict:
    """Background-safe entry point: open a new session, build features, dispatch.

    Skips inference when any required input is still missing — without a
    full feature vector the model would just see a near-constant input
    and produce a misleading prediction. Operators are expected to drive
    a proper PredictionTask when there's no cached answer to fall back on.

    `record_snapshot` is a plain dict of the health record fields (not an
    ORM object) so we don't touch objects attached to a closed session.
    """
    diag: dict = {
        "prediction_id": None,
        "alert_id": None,
        "followup_id": None,
        "skipped_reason": None,
    }
    try:
        async with AsyncSessionLocal() as session:
            features, _sources = await _assemble_features_for_health_record(
                session, elder_id, record_snapshot
            )
            gaps = missing_required(features)
            if gaps:
                logger.info(
                    "ml_orchestrator: skip inference elder_id=%s, missing=%s",
                    elder_id,
                    gaps,
                )
                diag["skipped_reason"] = "missing_required_inputs"
                return diag
            dispatched = await run_and_dispatch(session, elder_id, features)
            diag.update(dispatched)
            return diag
    except Exception:
        logger.exception(
            "ml_orchestrator.run_for_health_record failed elder_id=%s", elder_id
        )
        return diag
