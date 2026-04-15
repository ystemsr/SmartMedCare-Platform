"""Pydantic schemas for family member registration and responses."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class FamilyRegisterRequest(BaseModel):
    """Family member self-registration request."""

    invite_code: str = Field(..., min_length=1, max_length=16)
    real_name: str = Field(..., min_length=1, max_length=64)
    phone: str = Field(..., min_length=1, max_length=20)
    password: str = Field(..., min_length=6, max_length=128)
    relationship: str = Field(default="", max_length=32)
    captcha_token: str = Field(..., min_length=1)
    session_id: str = Field(..., min_length=1)


class FamilyMemberResponse(BaseModel):
    """Family member info response."""

    id: int
    user_id: int
    elder_id: int
    relationship: str
    real_name: str = ""
    phone: str = ""
    elder_name: str = ""
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class FamilyElderInfoResponse(BaseModel):
    """Elder info visible to family members."""

    elder_id: int
    name: str
    gender: str
    birth_date: Optional[str] = None
    phone: str = ""
    address: str = ""
    emergency_contact_name: str = ""
    emergency_contact_phone: str = ""
    tags: list[str] = []


class InviteCodeValidationResponse(BaseModel):
    """Response for invite code validation."""

    valid: bool
    elder_name: str = ""
    message: str = ""
