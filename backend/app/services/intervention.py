"""Service layer for intervention business logic."""

import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.followup import FollowupRepository
from app.repositories.intervention import InterventionRepository
from app.schemas.intervention import InterventionResponse
from app.utils.pagination import PaginationParams

logger = logging.getLogger(__name__)


async def _enrich_one(
    db: AsyncSession, response: InterventionResponse
) -> InterventionResponse:
    """Attach elder_name / performed_by_name to a single intervention response."""
    from app.models.elder import Elder
    from app.models.user import User

    if response.elder_id is not None:
        row = await db.execute(select(Elder.name).where(Elder.id == response.elder_id))
        response.elder_name = row.scalar_one_or_none()
    if response.performed_by is not None:
        row = await db.execute(
            select(User.real_name, User.username).where(User.id == response.performed_by)
        )
        item = row.first()
        if item is not None:
            response.performed_by_name = item[0] or item[1]
    return response


async def _enrich_list(db: AsyncSession, page):
    """Attach elder_name / performed_by_name to a paginated list of interventions."""
    from app.models.elder import Elder
    from app.models.user import User

    elder_ids = {item.elder_id for item in page.items if item.elder_id is not None}
    if elder_ids:
        rows = await db.execute(
            select(Elder.id, Elder.name).where(Elder.id.in_(elder_ids))
        )
        elder_map = {r[0]: r[1] for r in rows.all()}
        for item in page.items:
            if item.elder_id is not None:
                item.elder_name = elder_map.get(item.elder_id)

    performer_ids = {
        item.performed_by for item in page.items if item.performed_by is not None
    }
    if performer_ids:
        rows = await db.execute(
            select(User.id, User.real_name, User.username).where(
                User.id.in_(performer_ids)
            )
        )
        performer_map = {r[0]: (r[1] or r[2]) for r in rows.all()}
        for item in page.items:
            if item.performed_by is not None:
                item.performed_by_name = performer_map.get(item.performed_by)
    return page


class InterventionValidationError(Exception):
    """Raised when intervention input fails business validation."""


class InterventionService:
    """Business logic for interventions."""

    @staticmethod
    async def create(db: AsyncSession, data: dict) -> InterventionResponse:
        """Create a new intervention.

        Validates the optional `followup_id` points to an existing followup so
        the FK constraint doesn't surface as an opaque 500 error.
        """
        followup_id = data.get("followup_id")
        if followup_id is not None:
            followup = await FollowupRepository.get_by_id(db, followup_id)
            if followup is None:
                raise InterventionValidationError(
                    f"关联的随访记录不存在 (followup_id={followup_id})"
                )
        intervention = await InterventionRepository.create(db, data)
        await db.commit()
        response = InterventionResponse.model_validate(intervention)
        return await _enrich_one(db, response)

    @staticmethod
    async def get_by_id(
        db: AsyncSession, intervention_id: int
    ) -> Optional[InterventionResponse]:
        """Get an intervention by ID."""
        intervention = await InterventionRepository.get_by_id(db, intervention_id)
        if intervention is None:
            return None
        response = InterventionResponse.model_validate(intervention)
        return await _enrich_one(db, response)

    @staticmethod
    async def get_list(
        db: AsyncSession,
        pagination: PaginationParams,
        elder_id: Optional[int] = None,
        status: Optional[str] = None,
        type_: Optional[str] = None,
    ):
        """Get paginated list of interventions with elder/performer names."""
        page = await InterventionRepository.get_list(
            db, pagination, elder_id, status, type_,
        )
        return await _enrich_list(db, page)

    @staticmethod
    async def update(
        db: AsyncSession, intervention_id: int, data: dict
    ) -> Optional[InterventionResponse]:
        """Update an intervention."""
        intervention = await InterventionRepository.update(db, intervention_id, data)
        if intervention is None:
            return None
        await db.commit()
        response = InterventionResponse.model_validate(intervention)
        return await _enrich_one(db, response)

    @staticmethod
    async def update_status(
        db: AsyncSession,
        intervention_id: int,
        status: str,
        result: Optional[str] = None,
    ) -> Optional[InterventionResponse]:
        """Update the status of an intervention."""
        intervention = await InterventionRepository.update_status(
            db, intervention_id, status, result,
        )
        if intervention is None:
            return None
        await db.commit()
        response = InterventionResponse.model_validate(intervention)
        return await _enrich_one(db, response)

    @staticmethod
    async def delete(db: AsyncSession, intervention_id: int) -> bool:
        """Soft-delete an intervention."""
        deleted = await InterventionRepository.delete(db, intervention_id)
        if deleted:
            await db.commit()
        return deleted
