"""Analytics-related ORM models."""

from decimal import Decimal
from typing import Optional

from sqlalchemy import JSON, BigInteger, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class AnalyticsJob(BaseModel):
    """Analytics job tracking record."""

    __tablename__ = "analytics_jobs"

    job_type: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    job_id: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    result_summary: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class ElderRiskProfile(BaseModel):
    """Risk profile for an elder."""

    __tablename__ = "elder_risk_profiles"

    elder_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("elders.id"), nullable=False, unique=True
    )
    risk_score: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False, default="low")
    factors: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class DashboardSnapshot(BaseModel):
    """Dashboard data snapshot."""

    __tablename__ = "dashboard_snapshots"

    snapshot_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
