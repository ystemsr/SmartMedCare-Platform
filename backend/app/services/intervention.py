"""Service layer for intervention business logic."""

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.intervention import InterventionRepository
from app.schemas.intervention import InterventionResponse
from app.utils.pagination import PaginationParams

logger = logging.getLogger(__name__)


class InterventionService:
    """Business logic for interventions."""

    @staticmethod
    async def create(db: AsyncSession, data: dict) -> InterventionResponse:
        """Create a new intervention."""
        intervention = await InterventionRepository.create(db, data)
        await db.commit()
        return InterventionResponse.model_validate(intervention)

    @staticmethod
    async def get_by_id(
        db: AsyncSession, intervention_id: int
    ) -> Optional[InterventionResponse]:
        """Get an intervention by ID."""
        intervention = await InterventionRepository.get_by_id(db, intervention_id)
        if intervention is None:
            return None
        return InterventionResponse.model_validate(intervention)

    @staticmethod
    async def get_list(
        db: AsyncSession,
        pagination: PaginationParams,
        elder_id: Optional[int] = None,
        status: Optional[str] = None,
        type_: Optional[str] = None,
    ):
        """Get paginated list of interventions."""
        return await InterventionRepository.get_list(
            db, pagination, elder_id, status, type_,
        )

    @staticmethod
    async def update(
        db: AsyncSession, intervention_id: int, data: dict
    ) -> Optional[InterventionResponse]:
        """Update an intervention."""
        intervention = await InterventionRepository.update(db, intervention_id, data)
        if intervention is None:
            return None
        await db.commit()
        return InterventionResponse.model_validate(intervention)

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
        return InterventionResponse.model_validate(intervention)

    @staticmethod
    async def delete(db: AsyncSession, intervention_id: int) -> bool:
        """Soft-delete an intervention."""
        deleted = await InterventionRepository.delete(db, intervention_id)
        if deleted:
            await db.commit()
        return deleted
