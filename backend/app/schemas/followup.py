"""Pydantic schemas for followup endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class FollowupCreate(BaseModel):
    """Schema for creating a followup plan."""

    elder_id: int
    alert_id: Optional[int] = None
    plan_type: str
    planned_at: datetime
    assigned_to: Optional[int] = None
    notes: Optional[str] = None


class FollowupUpdate(BaseModel):
    """Schema for updating a followup plan."""

    plan_type: Optional[str] = None
    planned_at: Optional[datetime] = None
    assigned_to: Optional[int] = None
    notes: Optional[str] = None


class FollowupRecordCreate(BaseModel):
    """Schema for creating a followup record."""

    actual_time: datetime
    result: str
    next_action: Optional[str] = None
    status: str


class FollowupRecordResponse(BaseModel):
    """Schema for followup record response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    followup_id: int
    actual_time: Optional[datetime] = None
    result: Optional[str] = None
    next_action: Optional[str] = None
    status: str
    created_at: datetime


class FollowupResponse(BaseModel):
    """Schema for followup response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    elder_id: int
    elder_name: Optional[str] = None
    alert_id: Optional[int] = None
    plan_type: str
    planned_at: Optional[datetime] = None
    status: str
    assigned_to: Optional[int] = None
    assigned_to_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    records: Optional[list[FollowupRecordResponse]] = None
    alert_source: Optional[str] = None


class FollowupStatusUpdate(BaseModel):
    """Schema for updating followup status."""

    status: str
