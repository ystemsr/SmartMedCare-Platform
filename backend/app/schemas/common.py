"""Shared response schemas for the unified API response format."""

from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ErrorDetail(BaseModel):
    """Individual field-level error detail."""

    field: str
    reason: str


class UnifiedResponse(BaseModel, Generic[T]):
    """Unified API response wrapper.

    All API endpoints return this structure:
    - code 0 means success
    - non-zero code indicates an error (see error code constants)
    """

    code: int = 0
    message: str = "success"
    data: Optional[T] = None
    errors: Optional[List[ErrorDetail]] = None


class PaginatedData(BaseModel, Generic[T]):
    """Paginated list wrapper returned inside UnifiedResponse.data."""

    items: List[T]
    page: int
    page_size: int
    total: int
    total_pages: int
