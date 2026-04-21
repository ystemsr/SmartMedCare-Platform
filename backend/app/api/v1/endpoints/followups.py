"""Followup management API endpoints."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.schemas.followup import (
    FollowupCreate,
    FollowupRecordCreate,
    FollowupStatusUpdate,
    FollowupUpdate,
)
from app.services.followup import FollowupService
from app.utils.pagination import PaginationParams
from app.utils.response import NOT_FOUND, error_response, success_response

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("")
async def create_followup(
    body: FollowupCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("followup:create")),
):
    """Create a new followup plan."""
    followup = await FollowupService.create(db, body.model_dump())
    return success_response(data=followup.model_dump())


@router.get("")
async def list_followups(
    pagination: PaginationParams = Depends(),
    elder_id: Optional[int] = Query(None),
    assigned_to: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    plan_type: Optional[str] = Query(None),
    date_start: Optional[str] = Query(None),
    date_end: Optional[str] = Query(None),
    active_only: bool = Query(
        False,
        description="When true, restrict to actionable statuses (todo / in_progress / overdue)",
    ),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("followup:create")),
):
    """Get paginated list of followups."""
    result = await FollowupService.get_list(
        db, pagination, elder_id, assigned_to, status,
        plan_type, date_start, date_end,
        active_only=active_only,
    )
    return success_response(data=result.model_dump())


@router.get("/{followup_id}")
async def get_followup(
    followup_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("followup:create")),
):
    """Get followup detail with records."""
    followup = await FollowupService.get_by_id(db, followup_id)
    if followup is None:
        return error_response(NOT_FOUND, "Followup not found")
    return success_response(data=followup.model_dump())


@router.put("/{followup_id}")
async def update_followup(
    followup_id: int,
    body: FollowupUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("followup:update")),
):
    """Update a followup plan."""
    followup = await FollowupService.update(
        db, followup_id, body.model_dump(exclude_unset=True),
    )
    if followup is None:
        return error_response(NOT_FOUND, "Followup not found")
    return success_response(data=followup.model_dump())


@router.post("/{followup_id}/records")
async def add_followup_record(
    followup_id: int,
    body: FollowupRecordCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("followup:update")),
):
    """Add a record to a followup."""
    record = await FollowupService.add_record(db, followup_id, body.model_dump())
    if record is None:
        return error_response(NOT_FOUND, "Followup not found")
    return success_response(data=record.model_dump())


@router.patch("/{followup_id}/status")
async def update_followup_status(
    followup_id: int,
    body: FollowupStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("followup:update")),
):
    """Update the status of a followup."""
    followup = await FollowupService.update_status(db, followup_id, body.status)
    if followup is None:
        return error_response(NOT_FOUND, "Followup not found")
    return success_response(data=followup.model_dump())


@router.delete("/{followup_id}")
async def delete_followup(
    followup_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("followup:update")),
):
    """Soft-delete a followup."""
    deleted = await FollowupService.delete(db, followup_id)
    if not deleted:
        return error_response(NOT_FOUND, "Followup not found")
    return success_response(message="Followup deleted")
