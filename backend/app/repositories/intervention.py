"""Repository for Intervention model database operations."""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intervention import Intervention
from app.schemas.intervention import InterventionResponse
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)


class InterventionRepository:
    """Data access layer for interventions."""

    @staticmethod
    async def create(db: AsyncSession, data: dict) -> Intervention:
        """Create a new intervention."""
        intervention = Intervention(**data)
        db.add(intervention)
        await db.flush()
        await db.refresh(intervention)
        return intervention

    @staticmethod
    async def get_by_id(
        db: AsyncSession, intervention_id: int
    ) -> Optional[Intervention]:
        """Get an intervention by ID."""
        stmt = select(Intervention).where(
            Intervention.id == intervention_id,
            Intervention.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_list(
        db: AsyncSession,
        pagination: PaginationParams,
        elder_id: Optional[int] = None,
        status: Optional[str] = None,
        type_: Optional[str] = None,
    ):
        """Get paginated list of interventions with filters."""
        query = select(Intervention).where(Intervention.deleted_at.is_(None))

        if elder_id is not None:
            query = query.where(Intervention.elder_id == elder_id)
        if status is not None:
            query = query.where(Intervention.status == status)
        if type_ is not None:
            query = query.where(Intervention.type == type_)

        return await paginate(query, db, pagination, InterventionResponse)

    @staticmethod
    async def update(
        db: AsyncSession, intervention_id: int, data: dict
    ) -> Optional[Intervention]:
        """Update an intervention's fields."""
        intervention = await InterventionRepository.get_by_id(db, intervention_id)
        if intervention is None:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(intervention, key, value)
        await db.flush()
        await db.refresh(intervention)
        return intervention

    @staticmethod
    async def update_status(
        db: AsyncSession,
        intervention_id: int,
        status: str,
        result: Optional[str] = None,
    ) -> Optional[Intervention]:
        """Update the status of an intervention."""
        intervention = await InterventionRepository.get_by_id(db, intervention_id)
        if intervention is None:
            return None
        intervention.status = status
        if result is not None:
            intervention.result = result
        if status == "completed":
            intervention.performed_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(intervention)
        return intervention

    @staticmethod
    async def delete(db: AsyncSession, intervention_id: int) -> bool:
        """Soft-delete an intervention."""
        intervention = await InterventionRepository.get_by_id(db, intervention_id)
        if intervention is None:
            return False
        intervention.deleted_at = datetime.now(timezone.utc)
        await db.flush()
        return True
