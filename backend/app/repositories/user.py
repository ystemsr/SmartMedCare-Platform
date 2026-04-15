"""User repository — data access layer for User and UserRole."""

import logging
import math
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.role import Role, RolePermission
from app.models.user import User, UserRole
from app.schemas.common import PaginatedData
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.utils.pagination import PaginationParams

logger = logging.getLogger(__name__)


class UserRepository:
    """Data access methods for User entities."""

    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
        """Load a user by ID with eager-loaded roles and permissions."""
        stmt = (
            select(User)
            .options(
                selectinload(User.user_roles)
                .selectinload(UserRole.role)
                .selectinload(Role.role_permissions)
                .selectinload(RolePermission.permission)
            )
            .where(User.id == user_id, User.deleted_at.is_(None))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_username(db: AsyncSession, username: str) -> Optional[User]:
        """Load a user by username with eager-loaded roles and permissions."""
        stmt = (
            select(User)
            .options(
                selectinload(User.user_roles)
                .selectinload(UserRole.role)
                .selectinload(Role.role_permissions)
                .selectinload(RolePermission.permission)
            )
            .where(User.username == username, User.deleted_at.is_(None))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_list(
        db: AsyncSession,
        pagination: PaginationParams,
        status_filter: Optional[str] = None,
    ) -> PaginatedData:
        """Return a paginated list of users with eager-loaded roles."""
        base_stmt = select(User).where(User.deleted_at.is_(None))

        if status_filter:
            base_stmt = base_stmt.where(User.status == status_filter)

        if pagination.keyword:
            keyword = f"%{pagination.keyword}%"
            base_stmt = base_stmt.where(
                (User.username.like(keyword))
                | (User.real_name.like(keyword))
                | (User.phone.like(keyword))
            )

        # Count total
        count_stmt = base_stmt.with_only_columns(func.count()).order_by(None)
        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        # Sort and paginate
        sort_col = text(f"{pagination.sort_by} {pagination.sort_order}")
        stmt = (
            base_stmt
            .options(
                selectinload(User.user_roles)
                .selectinload(UserRole.role)
                .selectinload(Role.role_permissions)
                .selectinload(RolePermission.permission)
            )
            .order_by(sort_col)
            .limit(pagination.page_size)
            .offset((pagination.page - 1) * pagination.page_size)
        )
        result = await db.execute(stmt)
        users = result.scalars().all()

        total_pages = math.ceil(total / pagination.page_size) if total > 0 else 0
        items = [UserResponse.from_orm_user(u) for u in users]

        return PaginatedData(
            items=items,
            page=pagination.page,
            page_size=pagination.page_size,
            total=total,
            total_pages=total_pages,
        )

    @staticmethod
    async def create(db: AsyncSession, data: UserCreate, password_hash: str) -> User:
        """Create a new user and assign roles."""
        user = User(
            username=data.username,
            real_name=data.real_name,
            phone=data.phone,
            email=data.email,
            password_hash=password_hash,
            status="active",
        )
        db.add(user)
        await db.flush()

        # Assign roles
        for role_id in data.role_ids:
            user_role = UserRole(user_id=user.id, role_id=role_id)
            db.add(user_role)

        await db.commit()
        await db.refresh(user)
        logger.info("Created user: id=%s username=%s", user.id, user.username)
        return await UserRepository.get_by_id(db, user.id)

    @staticmethod
    async def update(db: AsyncSession, user_id: int, data: UserUpdate) -> Optional[User]:
        """Update user fields and optionally reassign roles."""
        user = await UserRepository.get_by_id(db, user_id)
        if user is None:
            return None

        update_fields = data.model_dump(exclude_unset=True, exclude={"role_ids"})
        for field, value in update_fields.items():
            setattr(user, field, value)

        # Reassign roles if provided
        if data.role_ids is not None:
            await UserRepository.assign_roles(db, user_id, data.role_ids)

        await db.commit()
        return await UserRepository.get_by_id(db, user_id)

    @staticmethod
    async def delete(db: AsyncSession, user_id: int) -> bool:
        """Soft delete a user."""
        user = await UserRepository.get_by_id(db, user_id)
        if user is None:
            return False
        user.deleted_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info("Soft-deleted user: id=%s", user_id)
        return True

    @staticmethod
    async def assign_roles(db: AsyncSession, user_id: int, role_ids: list[int]) -> None:
        """Replace all role assignments for a user."""
        # Remove existing role assignments
        stmt = select(UserRole).where(UserRole.user_id == user_id)
        result = await db.execute(stmt)
        existing = result.scalars().all()
        for ur in existing:
            await db.delete(ur)

        # Add new assignments
        for role_id in role_ids:
            user_role = UserRole(user_id=user_id, role_id=role_id)
            db.add(user_role)

        await db.flush()
