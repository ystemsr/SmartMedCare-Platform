"""Analytics API endpoints."""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.schemas.analytics import AnalyticsJobCreate
from app.services.analytics import AnalyticsService
from app.utils.response import NOT_FOUND, error_response, success_response

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/overview")
async def get_overview(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("analytics:read")),
):
    """Get platform-level analytics overview."""
    overview = await AnalyticsService.get_overview(db)
    return success_response(data=overview.model_dump())


@router.get("/age-distribution")
async def get_age_distribution(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("analytics:read")),
):
    """Get age distribution of elders."""
    data = await AnalyticsService.get_age_distribution(db)
    return success_response(data=[d.model_dump() for d in data])


@router.get("/chronic-disease-distribution")
async def get_chronic_disease_distribution(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("analytics:read")),
):
    """Get chronic disease distribution."""
    data = await AnalyticsService.get_chronic_disease_distribution(db)
    return success_response(data=[d.model_dump() for d in data])


@router.get("/risk-distribution")
async def get_risk_distribution(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("analytics:read")),
):
    """Get risk level distribution."""
    data = await AnalyticsService.get_risk_distribution(db)
    return success_response(data=[d.model_dump() for d in data])


@router.get("/alert-trend")
async def get_alert_trend(
    range: str = Query("7d", pattern="^(7d|30d|90d)$"),
    granularity: str = Query("day", pattern="^(day|week|month)$"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("analytics:read")),
):
    """Get alert trend data."""
    data = await AnalyticsService.get_alert_trend(db, range, granularity)
    return success_response(data=[d.model_dump() for d in data])


@router.get("/followup-completion")
async def get_followup_completion(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("analytics:read")),
):
    """Get followup completion rate statistics."""
    data = await AnalyticsService.get_followup_completion(db)
    return success_response(data=[d.model_dump() for d in data])


@router.get("/intervention-effectiveness")
async def get_intervention_effectiveness(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("analytics:read")),
):
    """Get intervention effectiveness by type."""
    data = await AnalyticsService.get_intervention_effectiveness(db)
    return success_response(data=[d.model_dump() for d in data])


@router.get("/elders/{elder_id}/risk-profile")
async def get_risk_profile(
    elder_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("analytics:read")),
):
    """Get risk profile for a specific elder."""
    profile = await AnalyticsService.get_risk_profile(db, elder_id)
    if profile is None:
        return error_response(NOT_FOUND, "Risk profile not found")
    return success_response(data=profile.model_dump())


@router.post("/jobs/run")
async def run_analytics_job(
    body: AnalyticsJobCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("analytics:run")),
):
    """Trigger an analytics job."""
    job = await AnalyticsService.run_job(db, body.job_type, body.date)
    return success_response(data=job.model_dump())


@router.get("/jobs/{job_id}")
async def get_analytics_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("analytics:read")),
):
    """Get analytics job status."""
    job = await AnalyticsService.get_job(db, job_id)
    if job is None:
        return error_response(NOT_FOUND, "Analytics job not found")
    return success_response(data=job.model_dump())
