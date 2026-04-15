"""Business logic for file management."""

import logging
import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import minio_client
from app.repositories.file import FileRepository
from app.schemas.file import FileResponse, FileUploadResponse

logger = logging.getLogger(__name__)


class FileService:
    """File management business operations."""

    @staticmethod
    async def upload(
        db: AsyncSession,
        file_name: str,
        file_bytes: bytes,
        content_type: str,
        category: str = "general",
        elder_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> FileUploadResponse:
        """Upload a file to MinIO and save metadata to the database."""
        # Generate object key
        prefix = f"{category}/{elder_id}" if elder_id else f"{category}/general"
        unique_name = f"{uuid.uuid4().hex}_{file_name}"
        object_key = f"{prefix}/{unique_name}"

        # Upload to MinIO
        await minio_client.upload_file(object_key, file_bytes, content_type)

        # Create DB record
        file_data = {
            "file_name": file_name,
            "object_key": object_key,
            "content_type": content_type,
            "size": len(file_bytes),
            "category": category,
            "elder_id": elder_id,
            "uploaded_by": user_id,
        }
        record = await FileRepository.create(db, file_data)
        await db.commit()
        await db.refresh(record)

        # Generate presigned URL
        url = await minio_client.get_presigned_url(object_key)

        logger.info("File uploaded: id=%s key=%s", record.id, object_key)
        return FileUploadResponse(
            file_id=record.id,
            file_name=record.file_name,
            object_key=record.object_key,
            content_type=record.content_type,
            size=record.size,
            url=url,
        )

    @staticmethod
    async def get_file(db: AsyncSession, file_id: int) -> FileResponse | None:
        """Get file metadata."""
        record = await FileRepository.get_by_id(db, file_id)
        if record is None:
            return None
        return FileResponse.model_validate(record)

    @staticmethod
    async def get_download_url(db: AsyncSession, file_id: int) -> str | None:
        """Get a presigned download URL for a file."""
        record = await FileRepository.get_by_id(db, file_id)
        if record is None:
            return None
        return await minio_client.get_presigned_url(record.object_key)

    @staticmethod
    async def delete_file(db: AsyncSession, file_id: int) -> bool:
        """Delete a file from MinIO and soft-delete the DB record."""
        record = await FileRepository.delete(db, file_id)
        if record is None:
            return False

        # Delete from MinIO
        try:
            await minio_client.delete_file(record.object_key)
        except Exception:
            logger.exception("Failed to delete file from MinIO: key=%s", record.object_key)

        await db.commit()
        logger.info("File deleted: id=%s key=%s", file_id, record.object_key)
        return True

    @staticmethod
    async def bind_file(
        db: AsyncSession, file_id: int, biz_type: str, biz_id: int
    ) -> bool:
        """Bind a file to a business record."""
        record = await FileRepository.get_by_id(db, file_id)
        if record is None:
            return False
        await FileRepository.create_binding(db, file_id, biz_type, biz_id)
        await db.commit()
        logger.info("File bound: file_id=%s biz_type=%s biz_id=%s", file_id, biz_type, biz_id)
        return True
