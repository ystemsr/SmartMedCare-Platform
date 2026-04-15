"""Pydantic schemas for intervention endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class InterventionCreate(BaseModel):
    """Schema for creating an intervention."""

    elder_id: int
    followup_id: Optional[int] = None
    type: str
    status: str = "planned"
    content: str
    planned_at: Optional[datetime] = None


class InterventionUpdate(BaseModel):
    """Schema for updating an intervention."""

    type: Optional[str] = None
    content: Optional[str] = None
    planned_at: Optional[datetime] = None


class InterventionStatusUpdate(BaseModel):
    """Schema for updating intervention status."""

    status: str
    result: Optional[str] = None


class InterventionResponse(BaseModel):
    """Schema for intervention response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    elder_id: int
    followup_id: Optional[int] = None
    type: str
    status: str
    content: Optional[str] = None
    planned_at: Optional[datetime] = None
    performed_by: Optional[int] = None
    performed_at: Optional[datetime] = None
    result: Optional[str] = None
    created_at: datetime
