"""Pydantic schemas for the AI knowledge base."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class KBDocumentOut(BaseModel):
    """Metadata for a single ingested document."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    role_code: str
    name: str
    file_type: str
    size: int
    status: str
    error_message: Optional[str] = None
    chunk_count: int
    uploaded_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class KBDocumentListOut(BaseModel):
    items: List[KBDocumentOut]


class KBUploadResult(BaseModel):
    """Outcome of a single file inside a batch upload."""

    name: str
    ok: bool
    error: Optional[str] = None
    document: Optional[KBDocumentOut] = None


class KBUploadBatchOut(BaseModel):
    items: List[KBUploadResult]


class KBPreviewHit(BaseModel):
    """One retrieval hit, for the admin "preview search" tool."""

    document_id: Optional[int] = None
    document_name: str = ""
    chunk_index: Optional[int] = None
    score: float = 0.0
    content: str = ""


class KBPreviewOut(BaseModel):
    hits: List[KBPreviewHit]
