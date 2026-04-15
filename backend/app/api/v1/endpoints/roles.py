"""Role and permission management endpoints."""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.models.user import User
from app.schemas.role import RoleCreate, RolePermissionUpdate
from app.services.role import RoleService
from app.utils.response import (
    CONFLICT,
    NOT_FOUND,
    error_response,
    success_response,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def list_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:manage")),
):
    """Return all roles with their permissions."""
    roles = await RoleService.list_roles(db)
    return success_response([r.model_dump() for r in roles])


@router.post("")
async def create_role(
    body: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:manage")),
):
    """Create a new role."""
    result = await RoleService.create_role(db, body)
    if isinstance(result, str):
        return error_response(CONFLICT, result)
    return success_response(result.model_dump())


@router.put("/{role_id}/permissions")
async def update_role_permissions(
    role_id: int,
    body: RolePermissionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:manage")),
):
    """Update permissions assigned to a role."""
    result = await RoleService.update_permissions(db, role_id, body.permissions)
    if result is None:
        return error_response(NOT_FOUND, "角色不存在")
    return success_response(result.model_dump())


@router.get("/permissions/tree")
async def get_permissions_tree(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:manage")),
):
    """Return all permissions in a tree structure grouped by resource."""
    tree = await RoleService.get_permissions_tree(db)
    return success_response([node.model_dump() for node in tree])
