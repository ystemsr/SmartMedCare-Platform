"""Pydantic schemas for file management."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class FileUploadResponse(BaseModel):
    """Schema returned after a successful file upload."""

    file_id: int
    file_name: str
    object_key: str
    content_type: str
    size: int
    url: Optional[str] = None


class FileResponse(BaseModel):
    """Schema for file record API responses."""

    id: int
    file_name: str
    object_key: str
    content_type: str
    size: int
    category: str
    elder_id: Optional[int] = None
    uploaded_by: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class FileBindRequest(BaseModel):
    """Schema for binding a file to a business record."""

    biz_type: str
    biz_id: int
