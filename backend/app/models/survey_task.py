"""SurveyTask ORM model — doctor-dispatched questionnaires for elders."""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class SurveyTask(BaseModel):
    """A questionnaire dispatched by a doctor to an elder.

    The doctor picks which feature fields the elder should fill
    (e.g. for ML prediction autofill gaps). The elder submits answers
    which are stored in `responses` and can be merged into prediction
    payloads.
    """

    __tablename__ = "survey_tasks"

    elder_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("elders.id"), nullable=False, index=True
    )
    doctor_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requested_fields: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    responses: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending", index=True
    )  # pending | submitted | cancelled
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
