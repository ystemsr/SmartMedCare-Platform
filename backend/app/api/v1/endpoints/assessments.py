"""Health assessment API endpoints."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.schemas.assessment import AssessmentCreate, AssessmentGenerate, AssessmentUpdate
from app.services.assessment import AssessmentService
from app.utils.pagination import PaginationParams
from app.utils.response import NOT_FOUND, BUSINESS_VALIDATION_FAILED, error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("")
async def create_assessment(
    body: AssessmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("assessment:create")),
):
    """Manually create a health assessment."""
    result = await AssessmentService.create_assessment(db, body, created_by=current_user.id)
    return success_response(data=result.model_dump(mode="json"))


@router.get("")
async def list_assessments(
    pagination: PaginationParams = Depends(),
    elder_id: Optional[int] = Query(None),
    risk_level: Optional[str] = Query(None),
    assessment_type: Optional[str] = Query(None),
    date_start: Optional[str] = Query(None),
    date_end: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("assessment:read")),
):
    """List assessments with filters and pagination."""
    result = await AssessmentService.list_assessments(
        db, pagination,
        elder_id=elder_id,
        risk_level=risk_level,
        assessment_type=assessment_type,
        date_start=date_start,
        date_end=date_end,
    )
    return success_response(data=result.model_dump(mode="json"))


@router.post("/generate")
async def generate_assessment(
    body: AssessmentGenerate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("assessment:create")),
):
    """Auto-generate an assessment from the latest health data."""
    result = await AssessmentService.generate_assessment(
        db, body.elder_id, force=body.force_recalculate, created_by=current_user.id,
    )
    if result is None:
        return error_response(
            BUSINESS_VALIDATION_FAILED,
            "No health records found for this elder",
        )
    return success_response(data=result.model_dump(mode="json"))


@router.get("/{assessment_id}")
async def get_assessment(
    assessment_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("assessment:read")),
):
    """Get assessment details."""
    result = await AssessmentService.get_assessment(db, assessment_id)
    if result is None:
        return error_response(NOT_FOUND, "Assessment not found")
    return success_response(data=result.model_dump(mode="json"))


@router.put("/{assessment_id}")
async def update_assessment(
    assessment_id: int,
    body: AssessmentUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("assessment:create")),
):
    """Update an assessment."""
    result = await AssessmentService.update_assessment(db, assessment_id, body)
    if result is None:
        return error_response(NOT_FOUND, "Assessment not found")
    return success_response(data=result.model_dump(mode="json"))


@router.delete("/{assessment_id}")
async def delete_assessment(
    assessment_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("assessment:create")),
):
    """Delete an assessment."""
    result = await AssessmentService.delete_assessment(db, assessment_id)
    if not result:
        return error_response(NOT_FOUND, "Assessment not found")
    return success_response(message="Assessment deleted")
