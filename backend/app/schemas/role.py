"""Role and permission management schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class PermissionBrief(BaseModel):
    """Brief permission info for role responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    description: str


class PermissionNode(BaseModel):
    """Permission tree node for hierarchical display."""

    code: str
    name: str
    description: str
    children: Optional[list["PermissionNode"]] = None


class RoleCreate(BaseModel):
    """Create role request body."""

    name: str = Field(..., min_length=1, max_length=64)
    display_name: str = Field(default="", max_length=128)


class RoleResponse(BaseModel):
    """Role response with permissions."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    display_name: str
    permissions: list[PermissionBrief] = []
    created_at: datetime

    @classmethod
    def from_orm_role(cls, role) -> "RoleResponse":
        """Build RoleResponse from a Role ORM instance with loaded relationships."""
        permissions = []
        for rp in role.role_permissions:
            permissions.append(
                PermissionBrief(
                    id=rp.permission.id,
                    code=rp.permission.code,
                    name=rp.permission.name,
                    description=rp.permission.description,
                )
            )
        return cls(
            id=role.id,
            name=role.name,
            display_name=role.display_name,
            permissions=permissions,
            created_at=role.created_at,
        )


class RolePermissionUpdate(BaseModel):
    """Update role permissions request body."""

    permissions: list[str] = Field(..., description="List of permission codes")
