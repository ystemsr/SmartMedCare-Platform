"""System configuration, audit logs, and login logs endpoints."""

import logging
import math
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.models.audit_log import AuditLog, LoginLog, SystemConfig
from app.models.user import User
from app.schemas.system import (
    AuditLogResponse,
    LoginLogResponse,
    SystemConfigResponse,
    SystemConfigUpdate,
)
from app.utils.response import NOT_FOUND, error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/configs")
async def list_configs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("system:config")),
):
    """Return all system configuration entries."""
    stmt = select(SystemConfig).order_by(SystemConfig.id)
    result = await db.execute(stmt)
    configs = result.scalars().all()
    data = [SystemConfigResponse.model_validate(c).model_dump() for c in configs]
    return success_response(data)


@router.put("/configs/{key}")
async def update_config(
    key: str,
    body: SystemConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("system:config")),
):
    """Update a system configuration value by key."""
    stmt = select(SystemConfig).where(SystemConfig.config_key == key)
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()

    if config is None:
        # Create if not exists (upsert behavior)
        config = SystemConfig(config_key=key, config_value=body.value)
        db.add(config)
    else:
        config.config_value = body.value

    await db.commit()
    await db.refresh(config)
    data = SystemConfigResponse.model_validate(config).model_dump()
    return success_response(data)


@router.get("/audit-logs")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: Optional[int] = Query(None),
    resource_type: Optional[str] = Query(None),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("system:audit")),
):
    """Return paginated audit logs."""
    stmt = select(AuditLog)

    if user_id is not None:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if resource_type is not None:
        stmt = stmt.where(AuditLog.resource_type == resource_type)

    # Count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    # Sort and paginate
    sort_col = text(f"created_at {sort_order}")
    stmt = stmt.order_by(sort_col)
    offset = (page - 1) * page_size
    stmt = stmt.limit(page_size).offset(offset)

    result = await db.execute(stmt)
    logs = result.scalars().all()

    total_pages = math.ceil(total / page_size) if total > 0 else 0
    items = [AuditLogResponse.model_validate(log).model_dump() for log in logs]

    data = {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
    }
    return success_response(data)


@router.get("/login-logs")
async def list_login_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("system:audit")),
):
    """Return paginated login logs."""
    stmt = select(LoginLog)

    if user_id is not None:
        stmt = stmt.where(LoginLog.user_id == user_id)
    if status is not None:
        stmt = stmt.where(LoginLog.status == status)

    # Count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    # Sort and paginate
    sort_col = text(f"created_at {sort_order}")
    stmt = stmt.order_by(sort_col)
    offset = (page - 1) * page_size
    stmt = stmt.limit(page_size).offset(offset)

    result = await db.execute(stmt)
    logs = result.scalars().all()

    total_pages = math.ceil(total / page_size) if total > 0 else 0
    items = [LoginLogResponse.model_validate(log).model_dump() for log in logs]

    data = {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
    }
    return success_response(data)
