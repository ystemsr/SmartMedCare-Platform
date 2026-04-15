"""Dashboard (workbench) API endpoints."""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.services.dashboard import DashboardService
from app.utils.response import success_response

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/overview")
async def get_overview(
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get dashboard overview statistics."""
    overview = await DashboardService.get_overview(db)
    return success_response(data=overview.model_dump())


@router.get("/todos")
async def get_todos(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get recent todo items."""
    todos = await DashboardService.get_todos(db, limit)
    return success_response(data=[t.model_dump() for t in todos])


@router.get("/trends")
async def get_trends(
    range: str = Query("7d", pattern="^(7d|30d|90d)$"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get trend data for the specified range."""
    trends = await DashboardService.get_trends(db, range)
    return success_response(data=[t.model_dump() for t in trends])
