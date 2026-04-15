"""Business logic for health records, medical records, and care records."""

import io
import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.health_archive import HealthRecord
from app.repositories.health_archive import (
    CareRecordRepository,
    HealthRecordRepository,
    MedicalRecordRepository,
)
from app.schemas.health_archive import (
    CareRecordCreate,
    CareRecordResponse,
    HealthRecordCreate,
    HealthRecordResponse,
    HealthRecordUpdate,
    MedicalRecordCreate,
    MedicalRecordResponse,
)
from app.utils.pagination import PaginationParams

logger = logging.getLogger(__name__)


class HealthArchiveService:
    """Business operations for health archive data."""

    # ---- Health Records ----

    @staticmethod
    async def create_health_record(
        db: AsyncSession, elder_id: int, data: HealthRecordCreate
    ) -> HealthRecordResponse:
        """Create a new health record for an elder."""
        record = await HealthRecordRepository.create(db, elder_id, data)
        await db.commit()
        await db.refresh(record)
        logger.info("Health record created: id=%s elder_id=%s", record.id, elder_id)
        return HealthRecordResponse.model_validate(record)

    @staticmethod
    async def list_health_records(
        db: AsyncSession, elder_id: int, pagination: PaginationParams
    ):
        """List health records for an elder with pagination."""
        return await HealthRecordRepository.get_list(db, elder_id, pagination)

    @staticmethod
    async def get_health_record(
        db: AsyncSession, record_id: int
    ) -> HealthRecordResponse | None:
        """Get a single health record."""
        record = await HealthRecordRepository.get_by_id(db, record_id)
        if record is None:
            return None
        return HealthRecordResponse.model_validate(record)

    @staticmethod
    async def update_health_record(
        db: AsyncSession, record_id: int, data: HealthRecordUpdate
    ) -> HealthRecordResponse | None:
        """Update a health record."""
        record = await HealthRecordRepository.update(db, record_id, data)
        if record is None:
            return None
        await db.commit()
        await db.refresh(record)
        logger.info("Health record updated: id=%s", record_id)
        return HealthRecordResponse.model_validate(record)

    @staticmethod
    async def delete_health_record(db: AsyncSession, record_id: int) -> bool:
        """Soft delete a health record."""
        result = await HealthRecordRepository.delete(db, record_id)
        if result:
            await db.commit()
            logger.info("Health record deleted: id=%s", record_id)
        return result

    @staticmethod
    async def import_health_records(
        db: AsyncSession, elder_id: int, file_bytes: bytes, content_type: str
    ) -> int:
        """Import health records from a CSV or Excel file.

        Returns the number of records imported.
        """
        import pandas as pd

        if "csv" in content_type:
            df = pd.read_csv(io.BytesIO(file_bytes))
        else:
            df = pd.read_excel(io.BytesIO(file_bytes))

        count = 0
        for _, row in df.iterrows():
            record = HealthRecord(
                elder_id=elder_id,
                height_cm=row.get("height_cm"),
                weight_kg=row.get("weight_kg"),
                blood_pressure_systolic=row.get("blood_pressure_systolic"),
                blood_pressure_diastolic=row.get("blood_pressure_diastolic"),
                blood_glucose=row.get("blood_glucose"),
                heart_rate=row.get("heart_rate"),
                temperature=row.get("temperature"),
                chronic_diseases=row.get("chronic_diseases") if not _is_nan(row.get("chronic_diseases")) else None,
                allergies=row.get("allergies") if not _is_nan(row.get("allergies")) else None,
                recorded_at=_parse_datetime(row.get("recorded_at")),
            )
            db.add(record)
            count += 1

        await db.flush()
        await db.commit()
        logger.info("Imported %d health records for elder_id=%s", count, elder_id)
        return count

    # ---- Medical Records ----

    @staticmethod
    async def create_medical_record(
        db: AsyncSession, elder_id: int, data: MedicalRecordCreate
    ) -> MedicalRecordResponse:
        """Create a medical record."""
        record = await MedicalRecordRepository.create(db, elder_id, data)
        await db.commit()
        await db.refresh(record)
        logger.info("Medical record created: id=%s elder_id=%s", record.id, elder_id)
        return MedicalRecordResponse.model_validate(record)

    @staticmethod
    async def list_medical_records(
        db: AsyncSession, elder_id: int, pagination: PaginationParams
    ):
        """List medical records for an elder with pagination."""
        return await MedicalRecordRepository.get_list(db, elder_id, pagination)

    # ---- Care Records ----

    @staticmethod
    async def create_care_record(
        db: AsyncSession, elder_id: int, data: CareRecordCreate
    ) -> CareRecordResponse:
        """Create a care record."""
        record = await CareRecordRepository.create(db, elder_id, data)
        await db.commit()
        await db.refresh(record)
        logger.info("Care record created: id=%s elder_id=%s", record.id, elder_id)
        return CareRecordResponse.model_validate(record)

    @staticmethod
    async def list_care_records(
        db: AsyncSession, elder_id: int, pagination: PaginationParams
    ):
        """List care records for an elder with pagination."""
        return await CareRecordRepository.get_list(db, elder_id, pagination)


def _is_nan(value) -> bool:
    """Check if a value is NaN (from pandas)."""
    try:
        import math
        return value is None or (isinstance(value, float) and math.isnan(value))
    except (TypeError, ValueError):
        return False


def _parse_datetime(value) -> datetime | None:
    """Parse a datetime value from a pandas cell."""
    if value is None or _is_nan(value):
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except (ValueError, TypeError):
        return None
