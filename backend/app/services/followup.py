"""Service layer for followup business logic."""

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.followup import FollowupRepository
from app.schemas.followup import FollowupRecordResponse, FollowupResponse
from app.utils.pagination import PaginationParams

logger = logging.getLogger(__name__)


class FollowupService:
    """Business logic for followups."""

    @staticmethod
    async def create(db: AsyncSession, data: dict) -> FollowupResponse:
        """Create a new followup plan."""
        followup = await FollowupRepository.create(db, data)
        await db.commit()
        return FollowupResponse.model_validate(followup)

    @staticmethod
    async def get_by_id(
        db: AsyncSession, followup_id: int
    ) -> Optional[FollowupResponse]:
        """Get a followup by ID with its records."""
        followup = await FollowupRepository.get_by_id(db, followup_id)
        if followup is None:
            return None
        return FollowupResponse.model_validate(followup)

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
        """Get paginated list of followups."""
        return await FollowupRepository.get_list(
            db, pagination, elder_id, assigned_to, status,
            plan_type, date_start, date_end,
        )

    @staticmethod
    async def update(
        db: AsyncSession, followup_id: int, data: dict
    ) -> Optional[FollowupResponse]:
        """Update a followup plan."""
        followup = await FollowupRepository.update(db, followup_id, data)
        if followup is None:
            return None
        await db.commit()
        return FollowupResponse.model_validate(followup)

    @staticmethod
    async def update_status(
        db: AsyncSession, followup_id: int, status: str
    ) -> Optional[FollowupResponse]:
        """Update the status of a followup."""
        followup = await FollowupRepository.update_status(db, followup_id, status)
        if followup is None:
            return None
        await db.commit()
        return FollowupResponse.model_validate(followup)

    @staticmethod
    async def delete(db: AsyncSession, followup_id: int) -> bool:
        """Soft-delete a followup."""
        deleted = await FollowupRepository.delete(db, followup_id)
        if deleted:
            await db.commit()
        return deleted

    @staticmethod
    async def add_record(
        db: AsyncSession, followup_id: int, data: dict
    ) -> Optional[FollowupRecordResponse]:
        """Add a record to a followup."""
        record = await FollowupRepository.add_record(db, followup_id, data)
        if record is None:
            return None
        await db.commit()
        return FollowupRecordResponse.model_validate(record)
