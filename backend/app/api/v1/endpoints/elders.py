"""Elder management API endpoints.

Includes nested routes for health records, medical records, and care records.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.schemas.elder import (
    AccountStatusUpdate,
    ElderCreate,
    ElderUpdate,
)
from app.schemas.health_archive import (
    CareRecordCreate,
    HealthRecordCreate,
    HealthRecordUpdate,
    MedicalRecordCreate,
)
from app.services.elder import ElderService
from app.services.health_archive import HealthArchiveService
from app.utils.pagination import PaginationParams
from app.utils.response import (
    NOT_FOUND,
    PARAM_ERROR,
    FILE_STORAGE_ERROR,
    error_response,
    success_response,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== Elder CRUD ====================


@router.post("")
async def create_elder(
    body: ElderCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("elder:create")),
):
    """Create a new elder profile."""
    result = await ElderService.create_elder(db, body)
    return success_response(data=result.model_dump(mode="json"))


@router.get("")
async def list_elders(
    pagination: PaginationParams = Depends(),
    gender: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    account_status: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("elder:read")),
):
    """List elders with pagination and filters."""
    result = await ElderService.list_elders(
        db, pagination,
        gender=gender, tag=tag,
        account_status=account_status, risk_level=risk_level,
    )
    return success_response(data=result.model_dump(mode="json"))


@router.get("/tags")
async def get_tags(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("elder:read")),
):
    """Get all distinct elder tags."""
    tags = await ElderService.get_tags(db)
    return success_response(data=tags)


@router.get("/{elder_id}")
async def get_elder(
    elder_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("elder:read")),
):
    """Get elder details by ID."""
    result = await ElderService.get_elder(db, elder_id)
    if result is None:
        return error_response(NOT_FOUND, "Elder not found")
    return success_response(data=result.model_dump(mode="json"))


@router.put("/{elder_id}")
async def update_elder(
    elder_id: int,
    body: ElderUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("elder:update")),
):
    """Update elder information."""
    result = await ElderService.update_elder(db, elder_id, body)
    if result is None:
        return error_response(NOT_FOUND, "Elder not found")
    return success_response(data=result.model_dump(mode="json"))


@router.delete("/{elder_id}")
async def delete_elder(
    elder_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("elder:delete")),
):
    """Soft delete an elder profile."""
    result = await ElderService.delete_elder(db, elder_id)
    if not result:
        return error_response(NOT_FOUND, "Elder not found")
    return success_response(message="Elder deleted")


@router.post("/{elder_id}/reset-password")
async def reset_password(
    elder_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("elder:update")),
):
    """Reset elder account password."""
    plain_password = await ElderService.reset_password(db, elder_id)
    if plain_password is None:
        return error_response(NOT_FOUND, "Elder not found")
    return success_response(data={"new_password": plain_password})


@router.post("/{elder_id}/account-status")
async def update_account_status(
    elder_id: int,
    body: AccountStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("elder:update")),
):
    """Enable or disable an elder account."""
    if body.account_status not in ("active", "disabled"):
        return error_response(PARAM_ERROR, "account_status must be 'active' or 'disabled'")
    result = await ElderService.update_account_status(db, elder_id, body.account_status)
    if not result:
        return error_response(NOT_FOUND, "Elder not found")
    return success_response(message="Account status updated")


# ==================== Health Records ====================


@router.post("/{elder_id}/health-records")
async def create_health_record(
    elder_id: int,
    body: HealthRecordCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("health_record:create")),
):
    """Create a health record for an elder."""
    result = await HealthArchiveService.create_health_record(db, elder_id, body)
    return success_response(data=result.model_dump(mode="json"))


@router.get("/{elder_id}/health-records")
async def list_health_records(
    elder_id: int,
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("health_record:read")),
):
    """List health records for an elder."""
    result = await HealthArchiveService.list_health_records(db, elder_id, pagination)
    return success_response(data=result.model_dump(mode="json"))


@router.get("/{elder_id}/health-records/{record_id}")
async def get_health_record(
    elder_id: int,
    record_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("health_record:read")),
):
    """Get a single health record."""
    result = await HealthArchiveService.get_health_record(db, record_id)
    if result is None:
        return error_response(NOT_FOUND, "Health record not found")
    return success_response(data=result.model_dump(mode="json"))


@router.put("/{elder_id}/health-records/{record_id}")
async def update_health_record(
    elder_id: int,
    record_id: int,
    body: HealthRecordUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("health_record:create")),
):
    """Update a health record."""
    result = await HealthArchiveService.update_health_record(db, record_id, body)
    if result is None:
        return error_response(NOT_FOUND, "Health record not found")
    return success_response(data=result.model_dump(mode="json"))


@router.delete("/{elder_id}/health-records/{record_id}")
async def delete_health_record(
    elder_id: int,
    record_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("health_record:create")),
):
    """Delete a health record."""
    result = await HealthArchiveService.delete_health_record(db, record_id)
    if not result:
        return error_response(NOT_FOUND, "Health record not found")
    return success_response(message="Health record deleted")


@router.post("/{elder_id}/health-records/import")
async def import_health_records(
    elder_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("health_record:create")),
):
    """Import health records from CSV/Excel."""
    if file.content_type not in (
        "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
    ):
        return error_response(PARAM_ERROR, "Only CSV and Excel files are supported")

    try:
        file_bytes = await file.read()
        count = await HealthArchiveService.import_health_records(
            db, elder_id, file_bytes, file.content_type or "text/csv"
        )
        return success_response(data={"imported_count": count})
    except Exception:
        logger.exception("Failed to import health records for elder_id=%s", elder_id)
        return error_response(FILE_STORAGE_ERROR, "Failed to import health records")


# ==================== Medical Records ====================


@router.post("/{elder_id}/medical-records")
async def create_medical_record(
    elder_id: int,
    body: MedicalRecordCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("health_record:create")),
):
    """Create a medical record for an elder."""
    result = await HealthArchiveService.create_medical_record(db, elder_id, body)
    return success_response(data=result.model_dump(mode="json"))


@router.get("/{elder_id}/medical-records")
async def list_medical_records(
    elder_id: int,
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("health_record:read")),
):
    """List medical records for an elder."""
    result = await HealthArchiveService.list_medical_records(db, elder_id, pagination)
    return success_response(data=result.model_dump(mode="json"))


# ==================== Care Records ====================


@router.post("/{elder_id}/care-records")
async def create_care_record(
    elder_id: int,
    body: CareRecordCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("health_record:create")),
):
    """Create a care record for an elder."""
    result = await HealthArchiveService.create_care_record(db, elder_id, body)
    return success_response(data=result.model_dump(mode="json"))


@router.get("/{elder_id}/care-records")
async def list_care_records(
    elder_id: int,
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("health_record:read")),
):
    """List care records for an elder."""
    result = await HealthArchiveService.list_care_records(db, elder_id, pagination)
    return success_response(data=result.model_dump(mode="json"))
