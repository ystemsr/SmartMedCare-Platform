"""Pydantic schemas for health assessments."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AssessmentCreate(BaseModel):
    """Schema for creating an assessment."""

    elder_id: int
    assessment_type: str = "comprehensive"
    score: Optional[int] = None
    risk_level: str = "low"
    summary: Optional[str] = None
    suggestions: Optional[list[str]] = None


class AssessmentUpdate(BaseModel):
    """Schema for updating an assessment. All fields optional."""

    assessment_type: Optional[str] = None
    score: Optional[int] = None
    risk_level: Optional[str] = None
    summary: Optional[str] = None
    suggestions: Optional[list[str]] = None


class AssessmentResponse(BaseModel):
    """Schema for assessment API responses."""

    id: int
    elder_id: int
    assessment_type: str
    score: Optional[int] = None
    risk_level: str
    summary: Optional[str] = None
    suggestions: Optional[list[str]] = None
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AssessmentGenerate(BaseModel):
    """Schema for auto-generating an assessment from health data."""

    elder_id: int
    force_recalculate: bool = False
