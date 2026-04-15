"""Repository layer for family member data access."""

import logging
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.family_member import FamilyMember

logger = logging.getLogger(__name__)


class FamilyMemberRepository:
    """Data access operations for family members."""

    @staticmethod
    async def get_by_user_id(db: AsyncSession, user_id: int) -> Optional[FamilyMember]:
        """Get family member by user account ID."""
        stmt = (
            select(FamilyMember)
            .options(selectinload(FamilyMember.elder))
            .where(FamilyMember.user_id == user_id, FamilyMember.deleted_at.is_(None))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_elder_id(db: AsyncSession, elder_id: int) -> list[FamilyMember]:
        """Get all family members linked to an elder."""
        stmt = (
            select(FamilyMember)
            .options(selectinload(FamilyMember.user))
            .where(FamilyMember.elder_id == elder_id, FamilyMember.deleted_at.is_(None))
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def count_by_elder_id(db: AsyncSession, elder_id: int) -> int:
        """Count active family members for an elder."""
        stmt = (
            select(func.count())
            .select_from(FamilyMember)
            .where(FamilyMember.elder_id == elder_id, FamilyMember.deleted_at.is_(None))
        )
        result = await db.execute(stmt)
        return result.scalar() or 0

    @staticmethod
    async def create(
        db: AsyncSession,
        user_id: int,
        elder_id: int,
        relationship: str = "",
    ) -> FamilyMember:
        """Create a family member record."""
        member = FamilyMember(
            user_id=user_id,
            elder_id=elder_id,
            relationship=relationship,
        )
        db.add(member)
        await db.flush()
        return member
