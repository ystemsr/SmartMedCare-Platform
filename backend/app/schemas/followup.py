"""Pydantic schemas for followup endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class FollowupAlertSummary(BaseModel):
    """Lightweight alert info embedded in a followup response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    risk_level: str
    status: str
    source: Optional[str] = None


class FollowupCreate(BaseModel):
    """Schema for creating a followup plan."""

    elder_id: int
    alert_ids: list[int] = Field(default_factory=list)
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
    alert_ids: Optional[list[int]] = None


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
    plan_type: str
    planned_at: Optional[datetime] = None
    status: str
    assigned_to: Optional[int] = None
    assigned_to_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    records: Optional[list[FollowupRecordResponse]] = None
    alerts: list[FollowupAlertSummary] = Field(default_factory=list)
    alert_ids: list[int] = Field(default_factory=list)
    alert_source: Optional[str] = None

    @model_validator(mode="after")
    def _derive_alert_fields(self):
        if self.alerts:
            if not self.alert_ids:
                self.alert_ids = [a.id for a in self.alerts]
            if self.alert_source is None:
                # Surface "ml" whenever any linked alert is AI-originated so
                # the UI badge keeps working with multiple alerts.
                if any((a.source or "") == "ml" for a in self.alerts):
                    self.alert_source = "ml"
        return self


class FollowupStatusUpdate(BaseModel):
    """Schema for updating followup status."""

    status: str
