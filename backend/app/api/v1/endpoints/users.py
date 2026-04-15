"""User management endpoints — CRUD operations for system users."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.services.user import UserService
from app.utils.pagination import PaginationParams
from app.utils.response import (
    CONFLICT,
    NOT_FOUND,
    error_response,
    success_response,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def list_users(
    pagination: PaginationParams = Depends(),
    status: Optional[str] = Query(None, pattern="^(active|disabled)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("user:manage")),
):
    """Return a paginated list of users."""
    result = await UserService.list_users(db, pagination, status)
    return success_response(result.model_dump())


@router.post("")
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("user:manage")),
):
    """Create a new system user."""
    result = await UserService.create_user(db, body)
    if isinstance(result, str):
        return error_response(CONFLICT, result)
    return success_response(result.model_dump())


@router.get("/{user_id}")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("user:manage")),
):
    """Get a user by ID."""
    result = await UserService.get_user(db, user_id)
    if result is None:
        return error_response(NOT_FOUND, "用户不存在")
    return success_response(result.model_dump())


@router.put("/{user_id}")
async def update_user(
    user_id: int,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("user:manage")),
):
    """Update a user's information."""
    result = await UserService.update_user(db, user_id, body)
    if result is None:
        return error_response(NOT_FOUND, "用户不存在")
    if isinstance(result, str):
        return error_response(CONFLICT, result)
    return success_response(result.model_dump())


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("user:manage")),
):
    """Soft delete a user."""
    deleted = await UserService.delete_user(db, user_id)
    if not deleted:
        return error_response(NOT_FOUND, "用户不存在")
    return success_response(message="用户已删除")
