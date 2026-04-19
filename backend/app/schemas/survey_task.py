"""Pydantic schemas for SurveyTask endpoints."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class SurveyTaskCreate(BaseModel):
    """Doctor dispatches a survey to an elder."""

    elder_id: int = Field(..., ge=1)
    requested_fields: list[str] = Field(..., min_length=1)
    title: str = Field("健康信息采集", max_length=128)
    message: Optional[str] = None
    due_at: Optional[datetime] = None


class SurveyTaskSubmit(BaseModel):
    """Elder submits answers."""

    responses: dict[str, Any] = Field(..., min_length=1)


class SurveyTaskResponse(BaseModel):
    """Survey task listing record."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    elder_id: int
    elder_name: Optional[str] = None
    doctor_user_id: int
    doctor_name: Optional[str] = None
    title: str
    message: Optional[str] = None
    requested_fields: list[str]
    responses: Optional[dict[str, Any]] = None
    status: str
    due_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
