"""Pydantic schemas for analytics endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AnalyticsOverview(BaseModel):
    """Platform-level analytics overview."""

    elder_total: int = 0
    male_total: int = 0
    female_total: int = 0
    high_risk_total: int = 0
    medium_risk_total: int = 0
    pending_alert_total: int = 0
    followup_completion_rate: float = 0.0


class AgeDistribution(BaseModel):
    """Age range distribution."""

    age_range: str
    count: int


class ChronicDiseaseDistribution(BaseModel):
    """Chronic disease distribution."""

    disease: str
    count: int


class RiskDistribution(BaseModel):
    """Risk level distribution."""

    risk_level: str
    count: int


class AlertTrend(BaseModel):
    """Alert trend data point."""

    date: str
    count: int
    risk_level: Optional[str] = None


class FollowupCompletion(BaseModel):
    """Followup completion rate for a period."""

    period: str
    total: int
    completed: int
    rate: float


class InterventionEffectiveness(BaseModel):
    """Intervention effectiveness by type."""

    type: str
    total: int
    completed: int
    success_rate: float


class RiskFactor(BaseModel):
    """A single risk factor."""

    name: str
    weight: float


class RiskProfile(BaseModel):
    """Elder risk profile."""

    model_config = ConfigDict(from_attributes=True)

    elder_id: int
    risk_score: Optional[float] = None
    risk_level: str
    factors: Optional[list[RiskFactor]] = None
    updated_at: Optional[datetime] = None


class AnalyticsJobCreate(BaseModel):
    """Schema for creating an analytics job."""

    job_type: str
    date: Optional[str] = None


class AnalyticsJobResponse(BaseModel):
    """Schema for analytics job response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    job_type: str
    job_id: str
    status: str
    result_summary: Optional[dict] = None
    created_at: datetime
