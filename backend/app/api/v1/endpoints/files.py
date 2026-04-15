"""File management API endpoints."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_permission
from app.schemas.file import FileBindRequest
from app.services.file import FileService
from app.utils.response import FILE_STORAGE_ERROR, NOT_FOUND, error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    category: str = Form("general"),
    elder_id: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("file:upload")),
):
    """Upload a file to MinIO."""
    try:
        file_bytes = await file.read()
        result = await FileService.upload(
            db,
            file_name=file.filename or "unnamed",
            file_bytes=file_bytes,
            content_type=file.content_type or "application/octet-stream",
            category=category,
            elder_id=elder_id,
            user_id=current_user.id,
        )
        return success_response(data=result.model_dump(mode="json"))
    except Exception:
        logger.exception("File upload failed")
        return error_response(FILE_STORAGE_ERROR, "File upload failed")


@router.get("/{file_id}")
async def get_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get file metadata."""
    result = await FileService.get_file(db, file_id)
    if result is None:
        return error_response(NOT_FOUND, "File not found")
    return success_response(data=result.model_dump(mode="json"))


@router.get("/{file_id}/download-url")
async def get_download_url(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get a presigned download URL for a file."""
    url = await FileService.get_download_url(db, file_id)
    if url is None:
        return error_response(NOT_FOUND, "File not found")
    return success_response(data={"url": url})


@router.delete("/{file_id}")
async def delete_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("file:upload")),
):
    """Delete a file from storage and database."""
    result = await FileService.delete_file(db, file_id)
    if not result:
        return error_response(NOT_FOUND, "File not found")
    return success_response(message="File deleted")


@router.post("/{file_id}/bind")
async def bind_file(
    file_id: int,
    body: FileBindRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Bind a file to a business record."""
    result = await FileService.bind_file(db, file_id, body.biz_type, body.biz_id)
    if not result:
        return error_response(NOT_FOUND, "File not found")
    return success_response(message="File bound successfully")
