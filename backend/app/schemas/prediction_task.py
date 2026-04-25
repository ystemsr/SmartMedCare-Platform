"""Pydantic schemas for prediction tasks."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---- Preview (doctor-side task creation wizard) ----


class InputsPreview(BaseModel):
    """What the doctor sees before creating a task for an elder."""

    elder_id: int
    elder_name: Optional[str] = None
    auto_inputs: dict[str, Any] = Field(default_factory=dict)
    permanent_inputs: dict[str, Any] = Field(default_factory=dict)
    doctor_keys: list[str] = Field(default_factory=list)
    elder_keys: list[str] = Field(default_factory=list)
    missing_required: list[str] = Field(default_factory=list)


# ---- Create ----


class PredictionTaskCreate(BaseModel):
    elder_id: int
    title: Optional[str] = "健康风险评估"
    message: Optional[str] = None
    doctor_inputs: dict[str, Any] = Field(default_factory=dict)
    due_at: Optional[datetime] = None


class PredictionTaskBatchCreate(BaseModel):
    """Create one task per elder_id with the same doctor_inputs."""

    elder_ids: list[int]
    title: Optional[str] = "健康风险评估"
    message: Optional[str] = None
    doctor_inputs: dict[str, Any] = Field(default_factory=dict)
    due_at: Optional[datetime] = None


# ---- Elder submit ----


class PredictionTaskElderSubmit(BaseModel):
    responses: dict[str, Any] = Field(default_factory=dict)


class PredictionTaskDoctorUpdate(BaseModel):
    """Doctor edits their inputs on a task still waiting for the elder."""

    doctor_inputs: dict[str, Any] = Field(default_factory=dict)


# ---- Response ----


class PredictionTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    elder_id: int
    doctor_user_id: int
    title: str
    message: Optional[str] = None
    status: str
    auto_inputs: Optional[dict[str, Any]] = None
    permanent_inputs: Optional[dict[str, Any]] = None
    doctor_inputs: Optional[dict[str, Any]] = None
    elder_requested_fields: list[str] = Field(default_factory=list)
    elder_inputs: Optional[dict[str, Any]] = None
    features_snapshot: Optional[dict[str, Any]] = None
    prediction_result_id: Optional[int] = None
    error_message: Optional[str] = None
    due_at: Optional[datetime] = None
    elder_submitted_at: Optional[datetime] = None
    predicted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Enriched on response
    elder_name: Optional[str] = None
    doctor_name: Optional[str] = None


class PredictionTaskWithResult(PredictionTaskResponse):
    """PredictionTask plus the linked prediction_result when available."""

    prediction: Optional[dict[str, Any]] = None
    contributions: Optional[list[dict[str, Any]]] = None
