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
    ):
        """Get paginated list of alerts."""
        return await AlertRepository.get_list(
            db, pagination, elder_id, type_, status, risk_level,
            date_start, date_end,
        )

    @staticmethod
    async def update_status(
        db: AsyncSession,
        alert_id: int,
        status: str,
        remark: Optional[str] = None,
    ) -> Optional[AlertResponse]:
        """Update the status of an alert."""
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
        """Batch update status for multiple alerts."""
        count = await AlertRepository.batch_update_status(db, ids, status, remark)
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
