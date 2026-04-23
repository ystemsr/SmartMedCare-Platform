"""Pydantic schemas for health assessments."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, field_validator


def _normalize_suggestions(value: Any) -> Any:
    """Coerce legacy dict-shaped suggestions into a flat list of strings.

    Older rows persisted suggestions as {"运动建议": "...", "饮食建议": "..."};
    the current contract is list[str]. Normalize on read so those rows remain
    usable without a data migration.
    """
    if value is None or isinstance(value, list):
        return value
    if isinstance(value, dict):
        items: list[str] = []
        for k, v in value.items():
            if v is None or v == "":
                items.append(str(k))
            else:
                items.append(f"{k}：{v}")
        return items
    if isinstance(value, str):
        return [value]
    return value


class AssessmentCreate(BaseModel):
    """Schema for creating an assessment."""

    elder_id: int
    assessment_type: str = "comprehensive"
    score: Optional[int] = None
    risk_level: str = "low"
    summary: Optional[str] = None
    suggestions: Optional[list[str]] = None

    @field_validator("suggestions", mode="before")
    @classmethod
    def _coerce_suggestions(cls, v: Any) -> Any:
        return _normalize_suggestions(v)


class AssessmentUpdate(BaseModel):
    """Schema for updating an assessment. All fields optional."""

    assessment_type: Optional[str] = None
    score: Optional[int] = None
    risk_level: Optional[str] = None
    summary: Optional[str] = None
    suggestions: Optional[list[str]] = None

    @field_validator("suggestions", mode="before")
    @classmethod
    def _coerce_suggestions(cls, v: Any) -> Any:
        return _normalize_suggestions(v)


class AssessmentResponse(BaseModel):
    """Schema for assessment API responses."""

    id: int
    elder_id: int
    elder_name: Optional[str] = None
    assessment_type: str
    score: Optional[int] = None
    risk_level: str
    summary: Optional[str] = None
    suggestions: Optional[list[str]] = None
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("suggestions", mode="before")
    @classmethod
    def _coerce_suggestions(cls, v: Any) -> Any:
        return _normalize_suggestions(v)


class AssessmentGenerate(BaseModel):
    """Schema for auto-generating an assessment from health data."""

    elder_id: int
    force_recalculate: bool = False
