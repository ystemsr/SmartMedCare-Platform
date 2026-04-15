"""Health record, medical record, and care record ORM models."""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class HealthRecord(BaseModel):
    """Periodic health measurement record for an elder."""

    __tablename__ = "health_records"

    elder_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("elders.id"), nullable=False
    )
    height_cm: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 1), nullable=True
    )
    weight_kg: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 1), nullable=True
    )
    blood_pressure_systolic: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    blood_pressure_diastolic: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    blood_glucose: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 1), nullable=True
    )
    heart_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    temperature: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(4, 1), nullable=True
    )
    chronic_diseases: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    allergies: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    recorded_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )


class MedicalRecord(BaseModel):
    """Hospital visit / medical treatment record."""

    __tablename__ = "medical_records"

    elder_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("elders.id"), nullable=False
    )
    visit_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    hospital_name: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    diagnosis: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    medications: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class CareRecord(BaseModel):
    """Daily care record for an elder."""

    __tablename__ = "care_records"

    elder_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("elders.id"), nullable=False
    )
    care_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    care_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    caregiver_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
