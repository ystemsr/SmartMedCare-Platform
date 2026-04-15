"""Intervention ORM model."""

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class Intervention(BaseModel):
    """Intervention record for an elder."""

    __tablename__ = "interventions"

    elder_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("elders.id"), nullable=False, index=True
    )
    followup_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("followups.id"), nullable=True
    )
    type: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="planned")
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    planned_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    performed_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=True
    )
    performed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
