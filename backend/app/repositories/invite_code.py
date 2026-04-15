"""Repository layer for invite code data access."""

import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invite_code import ElderInviteCode

logger = logging.getLogger(__name__)


class InviteCodeRepository:
    """Data access operations for elder invite codes."""

    @staticmethod
    async def get_by_code_for_update(
        db: AsyncSession, code: str
    ) -> Optional[ElderInviteCode]:
        """Get an invite code with row-level lock for atomic updates."""
        stmt = (
            select(ElderInviteCode)
            .where(
                ElderInviteCode.code == code,
                ElderInviteCode.deleted_at.is_(None),
            )
            .with_for_update()
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_code(
        db: AsyncSession, code: str
    ) -> Optional[ElderInviteCode]:
        """Get an invite code by its code string."""
        stmt = (
            select(ElderInviteCode)
            .where(
                ElderInviteCode.code == code,
                ElderInviteCode.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def increment_used_count(db: AsyncSession, code_id: int) -> None:
        """Increment the used_count of an invite code."""
        stmt = (
            select(ElderInviteCode)
            .where(ElderInviteCode.id == code_id)
            .with_for_update()
        )
        result = await db.execute(stmt)
        invite = result.scalar_one_or_none()
        if invite:
            invite.used_count += 1
            await db.flush()
