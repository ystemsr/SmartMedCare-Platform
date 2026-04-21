"""Service layer for alert business logic."""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.alert import AlertRepository
from app.schemas.alert import AlertResponse
from app.tasks.alert_rules import evaluate_health_rules
from app.utils.pagination import PaginationParams

logger = logging.getLogger(__name__)

# Allowed alert status transitions. Terminal statuses (resolved, ignored) cannot
# transition further. Setting to the same status is always allowed (no-op).
_ALLOWED_ALERT_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"processing", "resolved", "ignored"},
    "processing": {"resolved", "ignored"},
    "resolved": set(),
    "ignored": set(),
}
_ALLOWED_ALERT_STATUSES = {"pending", "processing", "resolved", "ignored"}


class AlertStatusTransitionError(Exception):
    """Raised when an alert status transition is not allowed."""


def _check_alert_transition(current: str, target: str) -> None:
    """Validate whether moving from `current` to `target` status is allowed."""
    if target not in _ALLOWED_ALERT_STATUSES:
        raise AlertStatusTransitionError(f"非法的预警状态: {target}")
    if current == target:
        return
    if target not in _ALLOWED_ALERT_TRANSITIONS.get(current, set()):
        raise AlertStatusTransitionError(
            f"预警状态不能从「{current}」变更为「{target}」"
        )


class AlertService:
    """Business logic for alerts."""

    @staticmethod
    async def create(db: AsyncSession, data: dict) -> AlertResponse:
        """Create a new alert manually."""
        data.setdefault("source", "manual")
        data.setdefault("triggered_at", datetime.now(timezone.utc))
        alert = await AlertRepository.create(db, data)
        await db.commit()
        return AlertResponse.model_validate(alert)

    @staticmethod
    async def create_with_source(
        db: AsyncSession, data: dict, source: str
    ) -> AlertResponse:
        """Create an alert with an explicit source (e.g. 'ml', 'rule').

        The existing `create()` defaults source to 'manual' for API callers;
        this method is for internal producers (rule engine, ML orchestrator)
        that need to tag their origin.
        """
        data = dict(data)
        data["source"] = source
        data.setdefault("triggered_at", datetime.now(timezone.utc))
        alert = await AlertRepository.create(db, data)
        await db.commit()
        return AlertResponse.model_validate(alert)

    @staticmethod
    async def get_by_id(db: AsyncSession, alert_id: int) -> Optional[AlertResponse]:
        """Get an alert by ID."""
        alert = await AlertRepository.get_by_id(db, alert_id)
        if alert is None:
            return None
        return AlertResponse.model_validate(alert)

    @staticmethod
    async def get_list(
        db: AsyncSession,
        pagination: PaginationParams,
        elder_id: Optional[int] = None,
        type_: Optional[str] = None,
        status: Optional[str] = None,
        risk_level: Optional[str] = None,
        date_start: Optional[str] = None,
        date_end: Optional[str] = None,
        source: Optional[str] = None,
        title: Optional[str] = None,
    ):
        """Get paginated list of alerts."""
        return await AlertRepository.get_list(
            db, pagination, elder_id, type_, status, risk_level,
            date_start, date_end, source=source, title=title,
        )

    @staticmethod
    async def update_status(
        db: AsyncSession,
        alert_id: int,
        status: str,
        remark: Optional[str] = None,
    ) -> Optional[AlertResponse]:
        """Update the status of an alert with transition validation."""
        current = await AlertRepository.get_by_id(db, alert_id)
        if current is None:
            return None
        _check_alert_transition(current.status, status)
        alert = await AlertRepository.update_status(db, alert_id, status, remark)
        if alert is None:
            return None
        await db.commit()
        return AlertResponse.model_validate(alert)

    @staticmethod
    async def batch_update_status(
        db: AsyncSession,
        ids: list[int],
        status: str,
        remark: Optional[str] = None,
    ) -> int:
        """Batch update status for multiple alerts, skipping invalid transitions."""
        if status not in _ALLOWED_ALERT_STATUSES:
            raise AlertStatusTransitionError(f"非法的预警状态: {status}")
        # Filter out alerts whose current status cannot transition to target.
        eligible_ids: list[int] = []
        for alert_id in ids:
            alert = await AlertRepository.get_by_id(db, alert_id)
            if alert is None:
                continue
            if alert.status == status:
                continue
            if status in _ALLOWED_ALERT_TRANSITIONS.get(alert.status, set()):
                eligible_ids.append(alert_id)
        if not eligible_ids:
            return 0
        count = await AlertRepository.batch_update_status(db, eligible_ids, status, remark)
        await db.commit()
        return count

    @staticmethod
    async def recheck(
        db: AsyncSession, elder_id: int
    ) -> list[AlertResponse]:
        """Trigger rule engine recheck for a specific elder."""
        new_alerts = await evaluate_health_rules(db, elder_id)
        await db.commit()
        return [AlertResponse.model_validate(a) for a in new_alerts]
