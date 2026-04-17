"""Big data job tracking and ML prediction result ORM models."""

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Float, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class BigDataJob(BaseModel):
    """Tracking record for a big data / Spark / Hive job submission."""

    __tablename__ = "bigdata_jobs"

    job_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    job_type: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    params: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    log_path: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    submitted_by: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)


class PredictionResult(BaseModel):
    """Latest ML prediction outcome for an elder."""

    __tablename__ = "prediction_results"

    elder_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    high_risk_prob: Mapped[float] = mapped_column(
        Numeric(6, 4), nullable=False, default=0
    )
    high_risk: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    followup_prob: Mapped[float] = mapped_column(
        Numeric(6, 4), nullable=False, default=0
    )
    followup_needed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    health_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    predicted_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False
    )
