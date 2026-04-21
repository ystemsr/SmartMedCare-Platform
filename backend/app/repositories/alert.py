"""Repository for Alert model database operations."""

import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert
from app.schemas.alert import AlertResponse
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)


class AlertRepository:
    """Data access layer for alerts."""

    @staticmethod
    async def create(db: AsyncSession, data: dict) -> Alert:
        """Create a new alert."""
        alert = Alert(**data)
        db.add(alert)
        await db.flush()
        await db.refresh(alert)
        return alert

    @staticmethod
    async def get_by_id(db: AsyncSession, alert_id: int) -> Optional[Alert]:
        """Get an alert by ID."""
        stmt = select(Alert).where(
            Alert.id == alert_id, Alert.deleted_at.is_(None)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

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
        """Get paginated list of alerts with filters."""
        query = select(Alert).where(Alert.deleted_at.is_(None))

        if elder_id is not None:
            query = query.where(Alert.elder_id == elder_id)
        if type_ is not None:
            query = query.where(Alert.type == type_)
        if status is not None:
            query = query.where(Alert.status == status)
        if risk_level is not None:
            query = query.where(Alert.risk_level == risk_level)
        if source is not None:
            query = query.where(Alert.source == source)
        if date_start is not None:
            query = query.where(Alert.created_at >= date_start)
        if date_end is not None:
            query = query.where(Alert.created_at <= date_end)
        if title:
            keyword = title.strip()
            if keyword:
                query = query.where(Alert.title.ilike(f"%{keyword}%"))

        return await paginate(query, db, pagination, AlertResponse)

    @staticmethod
    async def update_status(
        db: AsyncSession,
        alert_id: int,
        status: str,
        remark: Optional[str] = None,
    ) -> Optional[Alert]:
        """Update the status (and optionally remark) of an alert."""
        alert = await AlertRepository.get_by_id(db, alert_id)
        if alert is None:
            return None
        alert.status = status
        if remark is not None:
            alert.remark = remark
        await db.flush()
        await db.refresh(alert)
        return alert

    @staticmethod
    async def batch_update_status(
        db: AsyncSession,
        ids: list[int],
        status: str,
        remark: Optional[str] = None,
    ) -> int:
        """Batch update status for multiple alerts. Returns count updated."""
        values: dict = {"status": status}
        if remark is not None:
            values["remark"] = remark

        stmt = (
            update(Alert)
            .where(Alert.id.in_(ids), Alert.deleted_at.is_(None))
            .values(**values)
        )
        result = await db.execute(stmt)
        await db.flush()
        return result.rowcount  # type: ignore[return-value]
