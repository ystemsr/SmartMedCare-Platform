"""Repository for Followup and FollowupRecord model database operations."""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.alert import Alert
from app.models.followup import Followup, FollowupRecord
from app.schemas.followup import FollowupResponse
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)


async def _load_alerts(db: AsyncSession, alert_ids: list[int]) -> list[Alert]:
    """Fetch Alert rows for the given IDs, preserving input order."""
    if not alert_ids:
        return []
    rows = await db.execute(
        select(Alert).where(
            Alert.id.in_(alert_ids), Alert.deleted_at.is_(None)
        )
    )
    alerts = {a.id: a for a in rows.scalars().all()}
    return [alerts[i] for i in alert_ids if i in alerts]


class FollowupRepository:
    """Data access layer for followups."""

    @staticmethod
    async def create(db: AsyncSession, data: dict) -> Followup:
        """Create a new followup and link any referenced alerts."""
        alert_ids = data.pop("alert_ids", None) or []
        followup = Followup(**data)
        if alert_ids:
            followup.alerts = await _load_alerts(db, alert_ids)
        db.add(followup)
        await db.flush()
        await db.refresh(followup)
        return followup

    @staticmethod
    async def get_by_id(db: AsyncSession, followup_id: int) -> Optional[Followup]:
        """Get a followup by ID with records and alerts loaded."""
        stmt = (
            select(Followup)
            .options(
                selectinload(Followup.records),
                selectinload(Followup.alerts),
            )
            .where(Followup.id == followup_id, Followup.deleted_at.is_(None))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    ACTIVE_STATUSES = ("todo", "in_progress", "overdue")

    @staticmethod
    async def get_list(
        db: AsyncSession,
        pagination: PaginationParams,
        elder_id: Optional[int] = None,
        assigned_to: Optional[int] = None,
        status: Optional[str] = None,
        plan_type: Optional[str] = None,
        date_start: Optional[str] = None,
        date_end: Optional[str] = None,
        active_only: bool = False,
    ):
        """Get paginated list of followups with filters."""
        query = (
            select(Followup)
            .options(selectinload(Followup.alerts))
            .where(Followup.deleted_at.is_(None))
        )

        if elder_id is not None:
            query = query.where(Followup.elder_id == elder_id)
        if assigned_to is not None:
            query = query.where(Followup.assigned_to == assigned_to)
        if status is not None:
            query = query.where(Followup.status == status)
        elif active_only:
            query = query.where(Followup.status.in_(FollowupRepository.ACTIVE_STATUSES))
        if plan_type is not None:
            query = query.where(Followup.plan_type == plan_type)
        if date_start is not None:
            query = query.where(Followup.created_at >= date_start)
        if date_end is not None:
            query = query.where(Followup.created_at <= date_end)

        return await paginate(query, db, pagination, FollowupResponse)

    @staticmethod
    async def update(
        db: AsyncSession, followup_id: int, data: dict
    ) -> Optional[Followup]:
        """Update a followup's fields; replace alerts when alert_ids given."""
        followup = await FollowupRepository.get_by_id(db, followup_id)
        if followup is None:
            return None
        alert_ids = data.pop("alert_ids", None)
        for key, value in data.items():
            if value is not None:
                setattr(followup, key, value)
        if alert_ids is not None:
            # Explicit list overwrites — pass [] to clear all associations.
            followup.alerts = await _load_alerts(db, alert_ids)
        await db.flush()
        await db.refresh(followup)
        return followup

    @staticmethod
    async def update_status(
        db: AsyncSession, followup_id: int, status: str
    ) -> Optional[Followup]:
        """Update the status of a followup."""
        followup = await FollowupRepository.get_by_id(db, followup_id)
        if followup is None:
            return None
        followup.status = status
        await db.flush()
        await db.refresh(followup)
        return followup

    @staticmethod
    async def delete(db: AsyncSession, followup_id: int) -> bool:
        """Soft-delete a followup."""
        followup = await FollowupRepository.get_by_id(db, followup_id)
        if followup is None:
            return False
        followup.deleted_at = datetime.now(timezone.utc)
        await db.flush()
        return True

    @staticmethod
    async def add_record(
        db: AsyncSession, followup_id: int, record_data: dict
    ) -> Optional[FollowupRecord]:
        """Add a record to a followup."""
        followup = await FollowupRepository.get_by_id(db, followup_id)
        if followup is None:
            return None
        record = FollowupRecord(followup_id=followup_id, **record_data)
        db.add(record)
        await db.flush()
        await db.refresh(record)
        return record
