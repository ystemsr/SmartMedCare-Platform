"""Pydantic schemas for elder management."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


class ElderCreate(BaseModel):
    """Schema for creating an elder profile."""

    name: str
    gender: str = "unknown"
    birth_date: Optional[date] = None
    id_card: Optional[str] = None
    phone: str
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    tags: Optional[list[str]] = None


class ElderUpdate(BaseModel):
    """Schema for updating an elder profile. All fields optional."""

    name: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[date] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    tags: Optional[list[str]] = None


class ElderTagResponse(BaseModel):
    """Schema for a single elder tag."""

    tag_name: str

    model_config = ConfigDict(from_attributes=True)


class ElderResponse(BaseModel):
    """Schema for elder API responses."""

    id: int
    name: str
    gender: str
    birth_date: Optional[date] = None
    id_card: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    account_status: str
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    username: Optional[str] = None
    family_count: int = 0
    tags: list[str] = []
    created_at: Optional[datetime] = None
    latest_risk_score: Optional[float] = None
    latest_high_risk: Optional[bool] = None
    latest_prediction_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("tags", mode="before")
    @classmethod
    def extract_tag_names(cls, v: list) -> list[str]:
        """Extract tag_name strings from ElderTag ORM objects or plain strings."""
        if not v:
            return []
        result = []
        for item in v:
            if isinstance(item, str):
                result.append(item)
            elif hasattr(item, "tag_name"):
                result.append(item.tag_name)
            else:
                result.append(str(item))
        return result


class AccountStatusUpdate(BaseModel):
    """Schema for enabling/disabling an elder account."""

    account_status: str  # "active" or "disabled"
