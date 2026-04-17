"""ML orchestrator: run prediction and auto-dispatch alerts / followups.

This module closes the business loop: a health record create triggers
inference, and the result automatically materialises as an Alert (when
high-risk) and a Followup (when followup is needed), so operators see
AI-driven items alongside manual ones in the existing workflows.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.repositories.alert import AlertRepository
from app.repositories.bigdata import PredictionResultRepository
from app.repositories.elder import ElderRepository
from app.repositories.followup import FollowupRepository
from app.services import ml_inference

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
                    "alert_id": alert_id,
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


def build_features_from_health_record(record, elder=None) -> dict:
    """Map a HealthRecord (and optional Elder) to the 20-feature input dict.

    Health records don't carry most of the survey-style features the model
    was trained on, so non-vital features fall back to the scaler means
    (i.e. the training-population average) to keep inference stable.
    """
    defaults = dict(zip(ml_inference.FEATURE_COLS, ml_inference._SCALER_MEAN_RAW))

    def _num(value):
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    features: dict = dict(defaults)

    if elder is not None:
        if getattr(elder, "birth_date", None):
            try:
                today = datetime.now(timezone.utc).date()
                age = today.year - elder.birth_date.year - (
                    (today.month, today.day)
                    < (elder.birth_date.month, elder.birth_date.day)
                )
                features["AGE"] = float(age)
            except Exception:
                pass
        gender = getattr(elder, "gender", None)
        if gender is not None:
            features["IS_FEMALE"] = 1.0 if gender == "female" else 0.0

    height_cm = _num(getattr(record, "height_cm", None))
    weight_kg = _num(getattr(record, "weight_kg", None))
    if height_cm and weight_kg and height_cm > 0:
        bmi = weight_kg / ((height_cm / 100.0) ** 2)
        if bmi < 18.5:
            features["BMI_CATEGORY"] = 0.0
        elif bmi < 25:
            features["BMI_CATEGORY"] = 1.0
        elif bmi < 30:
            features["BMI_CATEGORY"] = 2.0
        else:
            features["BMI_CATEGORY"] = 3.0

    return features


async def run_for_health_record(elder_id: int, record_snapshot: dict) -> dict:
    """Background-safe entry point: open a new session, build features, dispatch.

    `record_snapshot` is a plain dict of the health record fields (not an ORM
    object) so we don't touch objects attached to a closed session.
    """
    try:
        async with AsyncSessionLocal() as session:
            elder = await ElderRepository.get_by_id(session, elder_id)
            record_obj = _DictView(record_snapshot)
            features = build_features_from_health_record(record_obj, elder=elder)
            return await run_and_dispatch(session, elder_id, features)
    except Exception:
        logger.exception(
            "ml_orchestrator.run_for_health_record failed elder_id=%s", elder_id
        )
        return {"prediction_id": None, "alert_id": None, "followup_id": None}


class _DictView:
    """Attribute-style access over a dict, for build_features_from_health_record."""

    def __init__(self, data: dict) -> None:
        self._data = data

    def __getattr__(self, name: str):
        return self._data.get(name)
