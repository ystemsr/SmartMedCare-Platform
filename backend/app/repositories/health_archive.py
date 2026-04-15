"""Repository layer for health, medical, and care record data access."""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.health_archive import CareRecord, HealthRecord, MedicalRecord
from app.schemas.health_archive import (
    CareRecordCreate,
    CareRecordResponse,
    HealthRecordCreate,
    HealthRecordResponse,
    HealthRecordUpdate,
    MedicalRecordCreate,
    MedicalRecordResponse,
)
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)


class HealthRecordRepository:
    """Data access for health records."""

    @staticmethod
    async def create(
        db: AsyncSession, elder_id: int, data: HealthRecordCreate
    ) -> HealthRecord:
        """Create a new health record."""
        record = HealthRecord(
            elder_id=elder_id,
            **data.model_dump(exclude_unset=True),
        )
        db.add(record)
        await db.flush()
        await db.refresh(record)
        return record

    @staticmethod
    async def get_list(
        db: AsyncSession, elder_id: int, pagination: PaginationParams
    ):
        """Get paginated health records for an elder."""
        stmt = select(HealthRecord).where(
            HealthRecord.elder_id == elder_id,
            HealthRecord.deleted_at.is_(None),
        )
        return await paginate(stmt, db, pagination, HealthRecordResponse)

    @staticmethod
    async def get_by_id(
        db: AsyncSession, record_id: int
    ) -> Optional[HealthRecord]:
        """Get a single health record by ID."""
        stmt = select(HealthRecord).where(
            HealthRecord.id == record_id,
            HealthRecord.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def update(
        db: AsyncSession, record_id: int, data: HealthRecordUpdate
    ) -> Optional[HealthRecord]:
        """Update a health record."""
        record = await HealthRecordRepository.get_by_id(db, record_id)
        if record is None:
            return None
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(record, field, value)
        await db.flush()
        await db.refresh(record)
        return record

    @staticmethod
    async def delete(db: AsyncSession, record_id: int) -> bool:
        """Soft delete a health record."""
        record = await HealthRecordRepository.get_by_id(db, record_id)
        if record is None:
            return False
        record.deleted_at = datetime.now(timezone.utc)
        await db.flush()
        return True

    @staticmethod
    async def get_latest_by_elder(
        db: AsyncSession, elder_id: int
    ) -> Optional[HealthRecord]:
        """Get the most recent health record for an elder."""
        stmt = (
            select(HealthRecord)
            .where(
                HealthRecord.elder_id == elder_id,
                HealthRecord.deleted_at.is_(None),
            )
            .order_by(HealthRecord.created_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


class MedicalRecordRepository:
    """Data access for medical records."""

    @staticmethod
    async def create(
        db: AsyncSession, elder_id: int, data: MedicalRecordCreate
    ) -> MedicalRecord:
        """Create a new medical record."""
        record = MedicalRecord(
            elder_id=elder_id,
            **data.model_dump(exclude_unset=True),
        )
        db.add(record)
        await db.flush()
        await db.refresh(record)
        return record

    @staticmethod
    async def get_list(
        db: AsyncSession, elder_id: int, pagination: PaginationParams
    ):
        """Get paginated medical records for an elder."""
        stmt = select(MedicalRecord).where(
            MedicalRecord.elder_id == elder_id,
            MedicalRecord.deleted_at.is_(None),
        )
        return await paginate(stmt, db, pagination, MedicalRecordResponse)


class CareRecordRepository:
    """Data access for care records."""

    @staticmethod
    async def create(
        db: AsyncSession, elder_id: int, data: CareRecordCreate
    ) -> CareRecord:
        """Create a new care record."""
        record = CareRecord(
            elder_id=elder_id,
            **data.model_dump(exclude_unset=True),
        )
        db.add(record)
        await db.flush()
        await db.refresh(record)
        return record

    @staticmethod
    async def get_list(
        db: AsyncSession, elder_id: int, pagination: PaginationParams
    ):
        """Get paginated care records for an elder."""
        stmt = select(CareRecord).where(
            CareRecord.elder_id == elder_id,
            CareRecord.deleted_at.is_(None),
        )
        return await paginate(stmt, db, pagination, CareRecordResponse)
