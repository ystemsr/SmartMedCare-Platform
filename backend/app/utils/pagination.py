"""Reusable pagination utilities for SQLAlchemy queries."""

import math
from typing import Any, Optional, Type

from fastapi import Query
from pydantic import BaseModel
from sqlalchemy import Select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.common import PaginatedData


class PaginationParams:
    """Common pagination query parameters for list endpoints."""

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number (starts at 1)"),
        page_size: int = Query(20, ge=1, le=100, description="Items per page"),
        keyword: Optional[str] = Query(None, description="Search keyword"),
        sort_by: str = Query("created_at", description="Sort field"),
        sort_order: str = Query("desc", pattern="^(asc|desc)$", description="Sort order"),
    ):
        self.page = page
        self.page_size = page_size
        self.keyword = keyword
        self.sort_by = sort_by
        self.sort_order = sort_order


async def paginate(
    query: Select,
    session: AsyncSession,
    pagination: PaginationParams,
    response_schema: Type[BaseModel],
) -> PaginatedData[Any]:
    """Apply pagination to a SQLAlchemy select query and return PaginatedData.

    Args:
        query: A SQLAlchemy Select statement (before limit/offset).
        session: The async database session.
        pagination: Pagination parameters from the request.
        response_schema: Pydantic schema to validate each row.

    Returns:
        PaginatedData with items, page, page_size, total, total_pages.
    """
    # Count total rows
    count_query = query.with_only_columns(func.count()).order_by(None)
    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    # Apply sorting
    sort_column = text(f"{pagination.sort_by} {pagination.sort_order}")
    query = query.order_by(sort_column)

    # Apply pagination
    offset = (pagination.page - 1) * pagination.page_size
    query = query.limit(pagination.page_size).offset(offset)

    result = await session.execute(query)
    rows = result.scalars().all()

    total_pages = math.ceil(total / pagination.page_size) if total > 0 else 0

    items = [response_schema.model_validate(row) for row in rows]

    return PaginatedData(
        items=items,
        page=pagination.page,
        page_size=pagination.page_size,
        total=total,
        total_pages=total_pages,
    )
