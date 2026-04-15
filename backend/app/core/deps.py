"""FastAPI dependency injection providers."""

import logging
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_async_session
from app.core.redis_client import redis_exists
from app.core.security import decode_token

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_db():
    """Yield an async database session."""
    async for session in get_async_session():
        yield session


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Decode JWT and load the current user from the database.

    Raises HTTP 401 if the token is invalid, expired, or the user
    cannot be found or is disabled.
    """
    # Check if token is blacklisted
    is_blacklisted = await redis_exists(f"token_blacklist:{token}")
    if is_blacklisted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
        )

    payload = decode_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id: int | None = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Import here to avoid circular imports — models may not be registered
    # until the feature branch that creates them is merged.
    from app.models.user import User, UserRole  # noqa: F811
    from app.models.role import Role, RolePermission, Permission  # noqa: F811

    stmt = (
        select(User)
        .options(
            selectinload(User.user_roles)
            .selectinload(UserRole.role)
            .selectinload(Role.role_permissions)
            .selectinload(RolePermission.permission)
        )
        .where(User.id == int(user_id), User.deleted_at.is_(None))
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled",
        )

    return user


def require_permission(permission: str) -> Callable:
    """Return a dependency that checks whether the current user holds
    the specified permission code. Raises HTTP 403 if not.
    """

    async def _check_permission(
        current_user=Depends(get_current_user),
    ):
        # Collect all permission codes from user roles
        user_permissions: set[str] = set()
        for user_role in current_user.user_roles:
            role = user_role.role
            for rp in role.role_permissions:
                user_permissions.add(rp.permission.code)

        if permission not in user_permissions:
            logger.warning(
                "Permission denied: user_id=%s required=%s",
                current_user.id,
                permission,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required",
            )
        return current_user

    return _check_permission
