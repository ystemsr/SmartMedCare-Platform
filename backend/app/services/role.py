"""Role management service — business logic for role and permission operations."""

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.role import RoleRepository
from app.schemas.role import (
    PermissionBrief,
    PermissionNode,
    RoleCreate,
    RoleResponse,
)

logger = logging.getLogger(__name__)


class RoleService:
    """Business logic for role and permission management."""

    @staticmethod
    async def list_roles(db: AsyncSession) -> list[RoleResponse]:
        """Return all roles with their permissions."""
        roles = await RoleRepository.get_all(db)
        return [RoleResponse.from_orm_role(r) for r in roles]

    @staticmethod
    async def create_role(db: AsyncSession, data: RoleCreate) -> RoleResponse | str:
        """Create a new role.

        Returns RoleResponse on success, or an error message string on failure.
        """
        existing = await RoleRepository.get_by_name(db, data.name)
        if existing is not None:
            return "角色名称已存在"

        role = await RoleRepository.create(db, data.name, data.display_name)
        return RoleResponse.from_orm_role(role)

    @staticmethod
    async def update_permissions(
        db: AsyncSession,
        role_id: int,
        permission_codes: list[str],
    ) -> Optional[RoleResponse]:
        """Update permissions for a role. Returns None if role not found."""
        role = await RoleRepository.update_permissions(db, role_id, permission_codes)
        if role is None:
            return None
        return RoleResponse.from_orm_role(role)

    @staticmethod
    async def get_permissions_tree(db: AsyncSession) -> list[PermissionNode]:
        """Build a permission tree grouped by resource prefix.

        Groups permissions by the part before ':' in the code,
        e.g. 'elder:create' -> group 'elder'.
        """
        permissions = await RoleRepository.get_all_permissions(db)

        # Group by prefix
        groups: dict[str, list[PermissionNode]] = {}
        for perm in permissions:
            parts = perm.code.split(":", 1)
            prefix = parts[0] if len(parts) > 1 else "other"
            node = PermissionNode(
                code=perm.code,
                name=perm.name,
                description=perm.description,
            )
            groups.setdefault(prefix, []).append(node)

        # Build tree nodes
        tree: list[PermissionNode] = []
        for prefix, children in groups.items():
            parent = PermissionNode(
                code=prefix,
                name=prefix,
                description=f"{prefix} permissions",
                children=children,
            )
            tree.append(parent)

        return tree
