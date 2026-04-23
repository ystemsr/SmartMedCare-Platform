"""Pydantic schemas for health records, medical records, and care records."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


def _coerce_string_list(value):
    """Accept list, None, or a scalar string (legacy rows) and return list[str]."""
    if value is None:
        return None
    if isinstance(value, list):
        return [str(v) for v in value]
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        for sep in (";", "；", ",", "，", "、", "/", "|"):
            if sep in text:
                parts = [p.strip() for p in text.split(sep) if p.strip()]
                return parts or None
        return [text]
    return [str(value)]


# ---- Health Records ----

class HealthRecordCreate(BaseModel):
    """Schema for creating a health record."""

    height_cm: Optional[Decimal] = None
    weight_kg: Optional[Decimal] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    blood_glucose: Optional[Decimal] = None
    heart_rate: Optional[int] = None
    temperature: Optional[Decimal] = None
    chronic_diseases: Optional[list[str]] = None
    allergies: Optional[list[str]] = None
    recorded_at: Optional[datetime] = None


class HealthRecordUpdate(BaseModel):
    """Schema for updating a health record. All fields optional."""

    height_cm: Optional[Decimal] = None
    weight_kg: Optional[Decimal] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    blood_glucose: Optional[Decimal] = None
    heart_rate: Optional[int] = None
    temperature: Optional[Decimal] = None
    chronic_diseases: Optional[list[str]] = None
    allergies: Optional[list[str]] = None
    recorded_at: Optional[datetime] = None


class HealthRecordResponse(BaseModel):
    """Schema for health record API responses."""

    id: int
    elder_id: int
    height_cm: Optional[Decimal] = None
    weight_kg: Optional[Decimal] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    blood_glucose: Optional[Decimal] = None
    heart_rate: Optional[int] = None
    temperature: Optional[Decimal] = None
    chronic_diseases: Optional[list[str]] = None
    allergies: Optional[list[str]] = None
    recorded_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("chronic_diseases", "allergies", mode="before")
    @classmethod
    def _tolerate_legacy_shape(cls, v):
        return _coerce_string_list(v)


# ---- Medical Records ----

class MedicalRecordCreate(BaseModel):
    """Schema for creating a medical record."""

    visit_date: date
    hospital_name: str
    department: str
    diagnosis: str
    medications: Optional[list[str]] = None
    remarks: Optional[str] = None


class MedicalRecordResponse(BaseModel):
    """Schema for medical record API responses."""

    id: int
    elder_id: int
    visit_date: Optional[date] = None
    hospital_name: Optional[str] = None
    department: Optional[str] = None
    diagnosis: Optional[str] = None
    medications: Optional[list[str]] = None
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ---- Care Records ----

class CareRecordCreate(BaseModel):
    """Schema for creating a care record."""

    care_type: str
    care_date: date
    content: str
    caregiver_name: str


class CareRecordResponse(BaseModel):
    """Schema for care record API responses."""

    id: int
    elder_id: int
    care_type: Optional[str] = None
    care_date: Optional[date] = None
    content: Optional[str] = None
    caregiver_name: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
