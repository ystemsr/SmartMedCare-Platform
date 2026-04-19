"""PredictionTask ORM model — each ML evaluation request is a task."""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import BigInteger, DateTime, String, Text
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class PredictionTask(BaseModel):
    """A doctor-initiated prediction task.

    Lifecycle:
      pending_elder      — waiting for the elder to submit dynamic fields
      pending_prediction — inputs complete, waiting for inference
      predicted          — inference done, prediction_result_id populated
      failed             — inference error; see error_message
      cancelled          — doctor cancelled before completion
    """

    __tablename__ = "prediction_tasks"

    elder_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    doctor_user_id: Mapped[int] = mapped_column(
        BigInteger, nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(
        String(128), nullable=False, default="健康风险评估"
    )
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="pending_elder", index=True
    )

    # Snapshots captured at create time (so later archive edits don't alter the task).
    auto_inputs: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    permanent_inputs: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Submitted by doctor during creation.
    doctor_inputs: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Which dynamic elder fields the task is asking for. Populated at create.
    elder_requested_fields: Mapped[list[str]] = mapped_column(JSON, nullable=False)

    # Submitted by elder. May include updated static fields (RACE / SCHLYRS).
    elder_inputs: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Final feature vector used for inference (debug/audit).
    features_snapshot: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Link to the prediction_results row once produced.
    prediction_result_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, nullable=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    elder_submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    predicted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
