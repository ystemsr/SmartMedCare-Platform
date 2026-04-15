"""User management service — business logic for user CRUD."""

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.repositories.user import UserRepository
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.utils.pagination import PaginationParams

logger = logging.getLogger(__name__)


class UserService:
    """Business logic for user management operations."""

    @staticmethod
    async def create_user(db: AsyncSession, data: UserCreate) -> UserResponse | str:
        """Create a new user.

        Returns UserResponse on success, or an error message string on failure.
        """
        # Check unique username
        existing = await UserRepository.get_by_username(db, data.username)
        if existing is not None:
            return "用户名已存在"

        password_hash = hash_password(data.password)
        user = await UserRepository.create(db, data, password_hash)
        return UserResponse.from_orm_user(user)

    @staticmethod
    async def get_user(db: AsyncSession, user_id: int) -> Optional[UserResponse]:
        """Get a user by ID."""
        user = await UserRepository.get_by_id(db, user_id)
        if user is None:
            return None
        return UserResponse.from_orm_user(user)

    @staticmethod
    async def list_users(
        db: AsyncSession,
        pagination: PaginationParams,
        status: Optional[str] = None,
        role: Optional[str] = None,
    ):
        """Return a paginated list of users."""
        return await UserRepository.get_list(db, pagination, status, role_name=role)

    @staticmethod
    async def update_user(
        db: AsyncSession,
        user_id: int,
        data: UserUpdate,
    ) -> UserResponse | str | None:
        """Update a user.

        Returns UserResponse on success, None if not found, or error message string.
        """
        user = await UserRepository.update(db, user_id, data)
        if user is None:
            return None
        return UserResponse.from_orm_user(user)

    @staticmethod
    async def delete_user(db: AsyncSession, user_id: int) -> bool:
        """Soft delete a user. Returns True if deleted, False if not found."""
        return await UserRepository.delete(db, user_id)
