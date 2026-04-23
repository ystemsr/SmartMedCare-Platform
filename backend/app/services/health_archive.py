"""Business logic for health records, medical records, and care records."""

import io
import logging
from datetime import datetime
from typing import Optional

from fastapi import BackgroundTasks
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
        db: AsyncSession,
        elder_id: int,
        data: HealthRecordCreate,
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> HealthRecordResponse:
        """Create a new health record for an elder.

        If `background_tasks` is provided, an ML prediction is scheduled
        after the response is sent; high-risk / followup-needed outcomes
        automatically create an Alert and Followup.
        """
        record = await HealthRecordRepository.create(db, elder_id, data)
        await db.commit()
        await db.refresh(record)
        logger.info("Health record created: id=%s elder_id=%s", record.id, elder_id)

        if background_tasks is not None:
            from app.services.ml_orchestrator import run_for_health_record

            snapshot = {
                "height_cm": record.height_cm,
                "weight_kg": record.weight_kg,
                "blood_pressure_systolic": record.blood_pressure_systolic,
                "blood_pressure_diastolic": record.blood_pressure_diastolic,
                "blood_glucose": record.blood_glucose,
                "heart_rate": record.heart_rate,
                "temperature": record.temperature,
            }
            background_tasks.add_task(run_for_health_record, elder_id, snapshot)

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

        Column headers must exactly match the English model field names:
        height_cm, weight_kg, blood_pressure_systolic, blood_pressure_diastolic,
        blood_glucose, heart_rate, temperature, chronic_diseases, allergies,
        recorded_at.

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
                height_cm=_clean_decimal(row.get("height_cm")),
                weight_kg=_clean_decimal(row.get("weight_kg")),
                blood_pressure_systolic=_clean_int(row.get("blood_pressure_systolic")),
                blood_pressure_diastolic=_clean_int(row.get("blood_pressure_diastolic")),
                blood_glucose=_clean_decimal(row.get("blood_glucose")),
                heart_rate=_clean_int(row.get("heart_rate")),
                temperature=_clean_decimal(row.get("temperature")),
                chronic_diseases=_parse_string_list(row.get("chronic_diseases")),
                allergies=_parse_string_list(row.get("allergies")),
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


def _clean_int(value) -> int | None:
    """Coerce a pandas cell to int, returning None for NaN / empty."""
    if value is None or _is_nan(value):
        return None
    try:
        if isinstance(value, str) and not value.strip():
            return None
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _clean_decimal(value):
    """Coerce a pandas cell to a value safe for a Numeric column."""
    from decimal import Decimal, InvalidOperation

    if value is None or _is_nan(value):
        return None
    try:
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return None
            return Decimal(stripped)
        return Decimal(str(value))
    except (TypeError, ValueError, InvalidOperation):
        return None


def _parse_string_list(value) -> list[str] | None:
    """Parse a cell into a list[str] for JSON columns (chronic_diseases / allergies).

    Accepts list input as-is, or splits strings on common separators so CSV
    cells like "糖尿病,高血压" become ["糖尿病", "高血压"].
    """
    if value is None or _is_nan(value):
        return None
    if isinstance(value, list):
        items = [str(v).strip() for v in value if str(v).strip()]
        return items or None
    text = str(value).strip()
    if not text:
        return None
    for sep in (";", "；", ",", "，", "、", "/", "|"):
        if sep in text:
            parts = [p.strip() for p in text.split(sep)]
            parts = [p for p in parts if p]
            return parts or None
    return [text]


def _parse_datetime(value) -> datetime | None:
    """Parse a datetime value from a pandas cell."""
    if value is None or _is_nan(value):
        return None
    if isinstance(value, datetime):
        return value
    try:
        import pandas as pd
        ts = pd.to_datetime(value, errors="coerce")
        if pd.isna(ts):
            return None
        return ts.to_pydatetime()
    except (ValueError, TypeError):
        return None
