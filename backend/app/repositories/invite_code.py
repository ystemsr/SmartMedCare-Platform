"""Repository layer for invite code data access."""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invite_code import ElderInviteCode

logger = logging.getLogger(__name__)


class InviteCodeRepository:
    """Data access operations for invite codes."""

    @staticmethod
    async def get_active_by_elder_id(
        db: AsyncSession, elder_id: int
    ) -> Optional[ElderInviteCode]:
        """Get the non-deleted invite code for an elder (permanent per elder)."""
        stmt = (
            select(ElderInviteCode)
            .where(
                ElderInviteCode.elder_id == elder_id,
                ElderInviteCode.deleted_at.is_(None),
            )
            .order_by(ElderInviteCode.created_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_code(db: AsyncSession, code: str) -> Optional[ElderInviteCode]:
        """Get invite code by code string."""
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
    async def get_by_code_for_update(db: AsyncSession, code: str) -> Optional[ElderInviteCode]:
        """Get invite code with row lock for registration."""
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
    async def create(
        db: AsyncSession,
        elder_id: int,
        code: str,
        expires_at: datetime,
        max_uses: int = 3,
    ) -> ElderInviteCode:
        """Create a new invite code."""
        invite = ElderInviteCode(
            elder_id=elder_id,
            code=code,
            expires_at=expires_at,
            max_uses=max_uses,
        )
        db.add(invite)
        await db.flush()
        return invite

    @staticmethod
    async def increment_used_count(db: AsyncSession, code_id: int) -> None:
        """Increment the used_count for an invite code."""
        stmt = select(ElderInviteCode).where(ElderInviteCode.id == code_id).with_for_update()
        result = await db.execute(stmt)
        invite = result.scalar_one_or_none()
        if invite:
            invite.used_count += 1
            await db.flush()

    @staticmethod
    async def soft_delete_by_elder_id(db: AsyncSession, elder_id: int) -> bool:
        """Soft delete all invite codes for an elder."""
        now = datetime.now(timezone.utc)
        stmt = (
            select(ElderInviteCode)
            .where(
                ElderInviteCode.elder_id == elder_id,
                ElderInviteCode.deleted_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        codes = result.scalars().all()
        for code in codes:
            code.deleted_at = now
        await db.flush()
        return len(codes) > 0
