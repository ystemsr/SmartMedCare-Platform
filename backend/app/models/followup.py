"""Followup and FollowupRecord ORM models."""

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Followup(BaseModel):
    """Follow-up plan for an elder."""

    __tablename__ = "followups"

    elder_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("elders.id"), nullable=False, index=True
    )
    alert_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("alerts.id"), nullable=True
    )
    plan_type: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    planned_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="todo")
    assigned_to: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    records = relationship(
        "FollowupRecord", back_populates="followup", lazy="selectin"
    )


class FollowupRecord(BaseModel):
    """Record of a completed follow-up visit."""

    __tablename__ = "followup_records"

    followup_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("followups.id"), nullable=False, index=True
    )
    actual_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="")

    followup = relationship("Followup", back_populates="records")
