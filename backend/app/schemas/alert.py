"""Pydantic schemas for alert (risk warning) endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AlertCreate(BaseModel):
    """Schema for creating a new alert."""

    elder_id: int
    type: str
    title: str
    description: Optional[str] = None
    risk_level: str = "low"


class AlertStatusUpdate(BaseModel):
    """Schema for updating an alert's status."""

    status: str
    remark: Optional[str] = None


class AlertBatchStatus(BaseModel):
    """Schema for batch updating alert statuses."""

    ids: list[int]
    status: str
    remark: Optional[str] = None


class AlertRecheckRequest(BaseModel):
    """Schema for triggering a rule engine recheck."""

    elder_id: int


class AlertResponse(BaseModel):
    """Schema for alert response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    elder_id: int
    type: str
    title: str
    description: Optional[str] = None
    risk_level: str
    status: str
    source: str
    remark: Optional[str] = None
    triggered_at: Optional[datetime] = None
    created_at: datetime


class AlertListQuery(BaseModel):
    """Schema for alert list query filters."""

    page: int = 1
    page_size: int = 20
    elder_id: Optional[int] = None
    type: Optional[str] = None
    status: Optional[str] = None
    risk_level: Optional[str] = None
    date_start: Optional[str] = None
    date_end: Optional[str] = None
