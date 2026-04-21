"""User management endpoints — CRUD operations for system users."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_permission
from app.models.role import Role
from app.models.user import User, UserRole
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


@router.get("/doctors")
async def search_doctors(
    keyword: Optional[str] = Query(None, description="搜索姓名/用户名/手机号"),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Lightweight search for users with the doctor role.

    Available to any authenticated user so assignment pickers (e.g. in
    follow-up plans) can resolve doctors without requiring ``user:manage``.
    """
    stmt = (
        select(User.id, User.username, User.real_name, User.phone)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(
            Role.name == "doctor",
            User.deleted_at.is_(None),
            User.status == "active",
        )
    )
    if keyword:
        like = f"%{keyword}%"
        stmt = stmt.where(
            or_(
                User.username.like(like),
                User.real_name.like(like),
                User.phone.like(like),
            )
        )
    stmt = stmt.order_by(User.id.asc()).limit(limit)
    rows = (await db.execute(stmt)).all()
    items = [
        {
            "id": r[0],
            "username": r[1],
            "real_name": r[2],
            "phone": r[3],
        }
        for r in rows
    ]
    return success_response(data=items)


@router.get("")
async def list_users(
    pagination: PaginationParams = Depends(),
    status: Optional[str] = Query(None, pattern="^(active|disabled)$"),
    role: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("user:manage")),
):
    """Return a paginated list of users."""
    result = await UserService.list_users(db, pagination, status, role=role)
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
