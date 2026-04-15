"""Role repository — data access layer for Role and Permission."""

import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.role import Permission, Role, RolePermission

logger = logging.getLogger(__name__)


class RoleRepository:
    """Data access methods for Role and Permission entities."""

    @staticmethod
    async def get_all(db: AsyncSession) -> list[Role]:
        """Return all non-deleted roles with their permissions."""
        stmt = (
            select(Role)
            .options(
                selectinload(Role.role_permissions)
                .selectinload(RolePermission.permission)
            )
            .where(Role.deleted_at.is_(None))
            .order_by(Role.id)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, role_id: int) -> Optional[Role]:
        """Load a role by ID with eager-loaded permissions."""
        stmt = (
            select(Role)
            .options(
                selectinload(Role.role_permissions)
                .selectinload(RolePermission.permission)
            )
            .where(Role.id == role_id, Role.deleted_at.is_(None))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_name(db: AsyncSession, name: str) -> Optional[Role]:
        """Load a role by unique name."""
        stmt = select(Role).where(Role.name == name, Role.deleted_at.is_(None))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create(db: AsyncSession, name: str, display_name: str) -> Role:
        """Create a new role."""
        role = Role(name=name, display_name=display_name)
        db.add(role)
        await db.commit()
        await db.refresh(role)
        logger.info("Created role: id=%s name=%s", role.id, role.name)
        return await RoleRepository.get_by_id(db, role.id)

    @staticmethod
    async def update_permissions(
        db: AsyncSession,
        role_id: int,
        permission_codes: list[str],
    ) -> Optional[Role]:
        """Replace all permission assignments for a role."""
        role = await RoleRepository.get_by_id(db, role_id)
        if role is None:
            return None

        # Remove existing permission assignments
        stmt = select(RolePermission).where(RolePermission.role_id == role_id)
        result = await db.execute(stmt)
        existing = result.scalars().all()
        for rp in existing:
            await db.delete(rp)

        # Look up permission IDs by codes
        perm_stmt = select(Permission).where(
            Permission.code.in_(permission_codes),
            Permission.deleted_at.is_(None),
        )
        perm_result = await db.execute(perm_stmt)
        permissions = perm_result.scalars().all()

        for perm in permissions:
            rp = RolePermission(role_id=role_id, permission_id=perm.id)
            db.add(rp)

        await db.commit()
        logger.info(
            "Updated permissions for role: id=%s codes=%s",
            role_id,
            permission_codes,
        )
        return await RoleRepository.get_by_id(db, role_id)

    @staticmethod
    async def get_all_permissions(db: AsyncSession) -> list[Permission]:
        """Return all non-deleted permissions."""
        stmt = (
            select(Permission)
            .where(Permission.deleted_at.is_(None))
            .order_by(Permission.id)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())
