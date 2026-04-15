"""Alert (risk warning) ORM model."""

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class Alert(BaseModel):
    """Risk warning alert for an elder."""

    __tablename__ = "alerts"

    elder_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("elders.id"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    title: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False, default="low")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    source: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    remark: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    triggered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )
