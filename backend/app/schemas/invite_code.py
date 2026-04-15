"""Pydantic schemas for invite codes."""

from datetime import datetime
from pydantic import BaseModel


class InviteCodeResponse(BaseModel):
    """Response for invite code."""
    code: str
    expires_at: datetime
    used_count: int
    max_uses: int
    remaining_slots: int

    model_config = {"from_attributes": True}


class InviteCodeValidateResponse(BaseModel):
    """Response for public invite code validation."""
    valid: bool
    elder_name: str = ""
    remaining_slots: int = 0
