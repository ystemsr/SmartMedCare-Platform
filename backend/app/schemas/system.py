"""System configuration, audit log, and health check schemas."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class SystemConfigResponse(BaseModel):
    """System config response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    config_key: str
    config_value: Optional[str] = None
    updated_at: datetime


class SystemConfigUpdate(BaseModel):
    """Update system config request body."""

    value: str


class AuditLogResponse(BaseModel):
    """Audit log response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    operation: str
    resource_type: str
    resource_id: Optional[int] = None
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    created_at: datetime


class LoginLogResponse(BaseModel):
    """Login log response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    login_time: Optional[datetime] = None
    ip_address: str
    user_agent: Optional[str] = None
    status: str
    logout_time: Optional[datetime] = None
    created_at: datetime


class HealthCheckResponse(BaseModel):
    """System health check response."""

    app: str
    mysql: str
    redis: str
    minio: str
    timestamp: datetime


class RuntimeInfo(BaseModel):
    """System runtime information."""

    python_version: str
    app_version: str
    app_name: str
    environment: str
    uptime_seconds: float
