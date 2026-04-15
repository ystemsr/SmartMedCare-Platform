"""Repository for Followup and FollowupRecord model database operations."""

import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.followup import Followup, FollowupRecord
from app.schemas.followup import FollowupResponse
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)


class FollowupRepository:
    """Data access layer for followups."""

    @staticmethod
    async def create(db: AsyncSession, data: dict) -> Followup:
        """Create a new followup."""
        followup = Followup(**data)
        db.add(followup)
        await db.flush()
        await db.refresh(followup)
        return followup

    @staticmethod
    async def get_by_id(db: AsyncSession, followup_id: int) -> Optional[Followup]:
        """Get a followup by ID with records loaded."""
        stmt = (
            select(Followup)
            .options(selectinload(Followup.records))
            .where(Followup.id == followup_id, Followup.deleted_at.is_(None))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

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
    ):
        """Get paginated list of followups with filters."""
        query = select(Followup).where(Followup.deleted_at.is_(None))

        if elder_id is not None:
            query = query.where(Followup.elder_id == elder_id)
        if assigned_to is not None:
            query = query.where(Followup.assigned_to == assigned_to)
        if status is not None:
            query = query.where(Followup.status == status)
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
        """Update a followup's fields."""
        followup = await FollowupRepository.get_by_id(db, followup_id)
        if followup is None:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(followup, key, value)
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
        followup.deleted_at = datetime.utcnow()
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
