"""Repository layer for assessment data access."""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assessment import Assessment
from app.schemas.assessment import AssessmentCreate, AssessmentResponse, AssessmentUpdate
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)


class AssessmentRepository:
    """Data access operations for assessments."""

    @staticmethod
    async def create(db: AsyncSession, data: AssessmentCreate, created_by: Optional[int] = None) -> Assessment:
        """Create a new assessment."""
        assessment = Assessment(
            elder_id=data.elder_id,
            assessment_type=data.assessment_type,
            score=data.score,
            risk_level=data.risk_level,
            summary=data.summary,
            suggestions=data.suggestions,
            created_by=created_by,
        )
        db.add(assessment)
        await db.flush()
        await db.refresh(assessment)
        return assessment

    @staticmethod
    async def get_list(
        db: AsyncSession,
        pagination: PaginationParams,
        elder_id: Optional[int] = None,
        risk_level: Optional[str] = None,
        assessment_type: Optional[str] = None,
        date_start: Optional[str] = None,
        date_end: Optional[str] = None,
    ):
        """Get paginated list of assessments with optional filters."""
        stmt = select(Assessment).where(Assessment.deleted_at.is_(None))

        if elder_id is not None:
            stmt = stmt.where(Assessment.elder_id == elder_id)
        if risk_level:
            stmt = stmt.where(Assessment.risk_level == risk_level)
        if assessment_type:
            stmt = stmt.where(Assessment.assessment_type == assessment_type)
        if date_start:
            stmt = stmt.where(Assessment.created_at >= date_start)
        if date_end:
            stmt = stmt.where(Assessment.created_at <= date_end)

        return await paginate(stmt, db, pagination, AssessmentResponse)

    @staticmethod
    async def get_by_id(db: AsyncSession, assessment_id: int) -> Optional[Assessment]:
        """Get a single assessment by ID."""
        stmt = select(Assessment).where(
            Assessment.id == assessment_id,
            Assessment.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def update(
        db: AsyncSession, assessment_id: int, data: AssessmentUpdate
    ) -> Optional[Assessment]:
        """Update an assessment."""
        assessment = await AssessmentRepository.get_by_id(db, assessment_id)
        if assessment is None:
            return None
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(assessment, field, value)
        await db.flush()
        await db.refresh(assessment)
        return assessment

    @staticmethod
    async def delete(db: AsyncSession, assessment_id: int) -> bool:
        """Soft delete an assessment."""
        assessment = await AssessmentRepository.get_by_id(db, assessment_id)
        if assessment is None:
            return False
        assessment.deleted_at = datetime.now(timezone.utc)
        await db.flush()
        return True

    @staticmethod
    async def get_latest_by_elder(
        db: AsyncSession, elder_id: int
    ) -> Optional[Assessment]:
        """Get the most recent assessment for an elder."""
        stmt = (
            select(Assessment)
            .where(
                Assessment.elder_id == elder_id,
                Assessment.deleted_at.is_(None),
            )
            .order_by(Assessment.created_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
