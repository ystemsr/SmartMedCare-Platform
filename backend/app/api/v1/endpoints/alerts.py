"""Alert (risk warning) API endpoints."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.schemas.alert import (
    AlertBatchStatus,
    AlertCreate,
    AlertRecheckRequest,
    AlertStatusUpdate,
)
from app.services.alert import AlertService, AlertStatusTransitionError
from app.utils.pagination import PaginationParams
from app.utils.response import (
    BUSINESS_VALIDATION_FAILED,
    NOT_FOUND,
    error_response,
    success_response,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("")
async def list_alerts(
    pagination: PaginationParams = Depends(),
    elder_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    date_start: Optional[str] = Query(None),
    date_end: Optional[str] = Query(None),
    title: Optional[str] = Query(None, description="Fuzzy match on alert title"),
    keyword: Optional[str] = Query(None, description="Alias for title search"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("alert:read")),
):
    """Get paginated list of alerts."""
    # `keyword` is the generic table search param used by the frontend; treat
    # it as a title filter when no explicit title is provided.
    effective_title = title if title else keyword
    result = await AlertService.get_list(
        db, pagination, elder_id, type, status, risk_level,
        date_start, date_end, source=source, title=effective_title,
    )
    return success_response(data=result.model_dump())


@router.post("/batch-status")
async def batch_update_alert_status(
    body: AlertBatchStatus,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("alert:update")),
):
    """Batch update alert statuses."""
    try:
        count = await AlertService.batch_update_status(
            db, body.ids, body.status, body.remark,
        )
    except AlertStatusTransitionError as exc:
        return error_response(BUSINESS_VALIDATION_FAILED, str(exc))
    return success_response(data={"updated_count": count})


@router.post("/recheck")
async def recheck_alerts(
    body: AlertRecheckRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("alert:update")),
):
    """Trigger rule engine recheck for an elder."""
    alerts = await AlertService.recheck(db, body.elder_id)
    return success_response(
        data=[a.model_dump() for a in alerts],
        message=f"Recheck completed, {len(alerts)} new alert(s) created",
    )


@router.get("/{alert_id}")
async def get_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("alert:read")),
):
    """Get alert detail by ID."""
    alert = await AlertService.get_by_id(db, alert_id)
    if alert is None:
        return error_response(NOT_FOUND, "Alert not found")
    return success_response(data=alert.model_dump())


@router.post("")
async def create_alert(
    body: AlertCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("alert:update")),
):
    """Manually create a new alert."""
    alert = await AlertService.create(db, body.model_dump())
    return success_response(data=alert.model_dump())


@router.patch("/{alert_id}/status")
async def update_alert_status(
    alert_id: int,
    body: AlertStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("alert:update")),
):
    """Update the status of an alert."""
    try:
        alert = await AlertService.update_status(db, alert_id, body.status, body.remark)
    except AlertStatusTransitionError as exc:
        return error_response(BUSINESS_VALIDATION_FAILED, str(exc))
    if alert is None:
        return error_response(NOT_FOUND, "Alert not found")
    return success_response(data=alert.model_dump())
