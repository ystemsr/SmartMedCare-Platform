"""Intervention API endpoints."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.schemas.intervention import (
    InterventionCreate,
    InterventionStatusUpdate,
    InterventionUpdate,
)
from app.services.intervention import InterventionService
from app.utils.pagination import PaginationParams
from app.utils.response import NOT_FOUND, error_response, success_response

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("")
async def create_intervention(
    body: InterventionCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("intervention:create")),
):
    """Create a new intervention."""
    intervention = await InterventionService.create(db, body.model_dump())
    return success_response(data=intervention.model_dump())


@router.get("")
async def list_interventions(
    pagination: PaginationParams = Depends(),
    elder_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("intervention:create")),
):
    """Get paginated list of interventions."""
    result = await InterventionService.get_list(
        db, pagination, elder_id, status, type,
    )
    return success_response(data=result.model_dump())


@router.get("/{intervention_id}")
async def get_intervention(
    intervention_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("intervention:create")),
):
    """Get intervention detail by ID."""
    intervention = await InterventionService.get_by_id(db, intervention_id)
    if intervention is None:
        return error_response(NOT_FOUND, "Intervention not found")
    return success_response(data=intervention.model_dump())


@router.put("/{intervention_id}")
async def update_intervention(
    intervention_id: int,
    body: InterventionUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("intervention:create")),
):
    """Update an intervention."""
    intervention = await InterventionService.update(
        db, intervention_id, body.model_dump(exclude_unset=True),
    )
    if intervention is None:
        return error_response(NOT_FOUND, "Intervention not found")
    return success_response(data=intervention.model_dump())


@router.patch("/{intervention_id}/status")
async def update_intervention_status(
    intervention_id: int,
    body: InterventionStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("intervention:create")),
):
    """Update the status of an intervention."""
    intervention = await InterventionService.update_status(
        db, intervention_id, body.status, body.result,
    )
    if intervention is None:
        return error_response(NOT_FOUND, "Intervention not found")
    return success_response(data=intervention.model_dump())


@router.delete("/{intervention_id}")
async def delete_intervention(
    intervention_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("intervention:create")),
):
    """Soft-delete an intervention."""
    deleted = await InterventionService.delete(db, intervention_id)
    if not deleted:
        return error_response(NOT_FOUND, "Intervention not found")
    return success_response(message="Intervention deleted")
