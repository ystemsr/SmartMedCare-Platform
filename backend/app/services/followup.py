"""Service layer for followup business logic."""

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.followup import FollowupRepository
from app.schemas.followup import FollowupRecordResponse, FollowupResponse
from app.utils.pagination import PaginationParams

logger = logging.getLogger(__name__)


async def _enrich_one(db: AsyncSession, response: FollowupResponse) -> FollowupResponse:
    """Attach elder_name / assigned_to_name to a single followup response."""
    from sqlalchemy import select as sa_select

    from app.models.elder import Elder
    from app.models.user import User

    if response.elder_id is not None:
        row = await db.execute(sa_select(Elder.name).where(Elder.id == response.elder_id))
        name = row.scalar_one_or_none()
        response.elder_name = name
    if response.assigned_to is not None:
        row = await db.execute(
            sa_select(User.real_name, User.username).where(User.id == response.assigned_to)
        )
        item = row.first()
        if item is not None:
            response.assigned_to_name = item[0] or item[1]
    return response


class FollowupService:
    """Business logic for followups."""

    @staticmethod
    async def create(db: AsyncSession, data: dict) -> FollowupResponse:
        """Create a new followup plan."""
        followup = await FollowupRepository.create(db, data)
        await db.commit()
        # Re-fetch so selectinload populates alerts/records for the response.
        followup = await FollowupRepository.get_by_id(db, followup.id)
        response = FollowupResponse.model_validate(followup)
        return await _enrich_one(db, response)

    @staticmethod
    async def get_by_id(
        db: AsyncSession, followup_id: int
    ) -> Optional[FollowupResponse]:
        """Get a followup by ID with its records."""
        followup = await FollowupRepository.get_by_id(db, followup_id)
        if followup is None:
            return None
        response = FollowupResponse.model_validate(followup)
        return await _enrich_one(db, response)

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
        """Get paginated list of followups, with elder/assignee names attached."""
        page = await FollowupRepository.get_list(
            db, pagination, elder_id, assigned_to, status,
            plan_type, date_start, date_end,
            active_only=active_only,
        )

        from sqlalchemy import select as sa_select

        elder_ids = {item.elder_id for item in page.items if item.elder_id is not None}
        if elder_ids:
            from app.models.elder import Elder

            rows = await db.execute(
                sa_select(Elder.id, Elder.name).where(Elder.id.in_(elder_ids))
            )
            elder_map = {r[0]: r[1] for r in rows.all()}
            for item in page.items:
                if item.elder_id is not None:
                    item.elder_name = elder_map.get(item.elder_id)

        assignee_ids = {
            item.assigned_to for item in page.items if item.assigned_to is not None
        }
        if assignee_ids:
            from app.models.user import User

            rows = await db.execute(
                sa_select(User.id, User.real_name, User.username).where(
                    User.id.in_(assignee_ids)
                )
            )
            assignee_map = {r[0]: (r[1] or r[2]) for r in rows.all()}
            for item in page.items:
                if item.assigned_to is not None:
                    item.assigned_to_name = assignee_map.get(item.assigned_to)

        return page

    @staticmethod
    async def update(
        db: AsyncSession, followup_id: int, data: dict
    ) -> Optional[FollowupResponse]:
        """Update a followup plan."""
        followup = await FollowupRepository.update(db, followup_id, data)
        if followup is None:
            return None
        await db.commit()
        followup = await FollowupRepository.get_by_id(db, followup.id)
        response = FollowupResponse.model_validate(followup)
        return await _enrich_one(db, response)

    @staticmethod
    async def update_status(
        db: AsyncSession, followup_id: int, status: str
    ) -> Optional[FollowupResponse]:
        """Update the status of a followup."""
        followup = await FollowupRepository.update_status(db, followup_id, status)
        if followup is None:
            return None
        await db.commit()
        # Re-fetch so the relationship eager-loads for the response.
        followup = await FollowupRepository.get_by_id(db, followup.id)
        response = FollowupResponse.model_validate(followup)
        return await _enrich_one(db, response)

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
        """Add a record to a followup.

        Promotes the parent followup's status to match the record's status
        (e.g. marks the followup as completed once the doctor logs a
        completed visit).
        """
        record = await FollowupRepository.add_record(db, followup_id, data)
        if record is None:
            return None
        record_status = data.get("status")
        if record_status:
            await FollowupRepository.update_status(db, followup_id, record_status)
        await db.commit()
        return FollowupRecordResponse.model_validate(record)
