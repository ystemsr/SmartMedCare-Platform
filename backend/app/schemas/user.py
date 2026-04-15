"""User management request/response schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RoleBrief(BaseModel):
    """Brief role info for user responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    display_name: str


class UserCreate(BaseModel):
    """Create user request body."""

    username: str = Field(..., min_length=2, max_length=64)
    real_name: str = Field(..., min_length=1, max_length=64)
    phone: str = Field(default="", max_length=20)
    email: str = Field(default="", max_length=128)
    password: str = Field(..., min_length=6)
    role_ids: list[int] = Field(default_factory=list)


class UserUpdate(BaseModel):
    """Update user request body."""

    real_name: Optional[str] = Field(None, max_length=64)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=128)
    status: Optional[str] = Field(None, pattern="^(active|disabled)$")
    role_ids: Optional[list[int]] = None


class UserResponse(BaseModel):
    """User response with role info."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    real_name: str
    phone: str
    email: str
    status: str
    roles: list[RoleBrief] = []
    created_at: datetime

    @classmethod
    def from_orm_user(cls, user) -> "UserResponse":
        """Build UserResponse from a User ORM instance with loaded relationships."""
        roles = []
        for ur in user.user_roles:
            roles.append(
                RoleBrief(
                    id=ur.role.id,
                    name=ur.role.name,
                    display_name=ur.role.display_name,
                )
            )
        return cls(
            id=user.id,
            username=user.username,
            real_name=user.real_name,
            phone=user.phone,
            email=user.email,
            status=user.status,
            roles=roles,
            created_at=user.created_at,
        )
