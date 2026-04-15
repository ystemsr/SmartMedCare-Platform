"""Repository layer for file record data access."""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.file_record import FileBinding, FileRecord

logger = logging.getLogger(__name__)


class FileRepository:
    """Data access operations for file records."""

    @staticmethod
    async def create(db: AsyncSession, file_data: dict) -> FileRecord:
        """Create a new file record."""
        record = FileRecord(**file_data)
        db.add(record)
        await db.flush()
        await db.refresh(record)
        return record

    @staticmethod
    async def get_by_id(db: AsyncSession, file_id: int) -> Optional[FileRecord]:
        """Get a file record by ID."""
        stmt = select(FileRecord).where(
            FileRecord.id == file_id,
            FileRecord.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def delete(db: AsyncSession, file_id: int) -> Optional[FileRecord]:
        """Soft delete a file record. Returns the record for cleanup."""
        record = await FileRepository.get_by_id(db, file_id)
        if record is None:
            return None
        record.deleted_at = datetime.now(timezone.utc)
        await db.flush()
        return record

    @staticmethod
    async def create_binding(
        db: AsyncSession, file_id: int, biz_type: str, biz_id: int
    ) -> FileBinding:
        """Create a binding between a file and a business record."""
        binding = FileBinding(
            file_id=file_id,
            biz_type=biz_type,
            biz_id=biz_id,
        )
        db.add(binding)
        await db.flush()
        await db.refresh(binding)
        return binding
