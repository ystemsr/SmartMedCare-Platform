"""Pydantic schemas for dashboard endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DashboardOverview(BaseModel):
    """Dashboard overview statistics."""

    elder_total: int = 0
    high_risk_total: int = 0
    pending_alert_total: int = 0
    todo_followup_total: int = 0
    completed_followup_today: int = 0
    assessment_total_today: int = 0


class TodoItem(BaseModel):
    """A single todo item on the dashboard."""

    id: int
    type: str  # "alert" / "followup" / "assessment"
    title: str
    elder_name: Optional[str] = None
    risk_level: Optional[str] = None
    planned_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class TrendData(BaseModel):
    """Daily trend data point."""

    date: str
    alerts: int = 0
    followups: int = 0
    assessments: int = 0
