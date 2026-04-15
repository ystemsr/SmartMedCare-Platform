"""System health check and runtime info endpoints."""

import logging
import sys
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, get_db, require_permission
from app.core.minio_client import check_health as minio_check_health
from app.core import redis_client as redis_module
from app.models.user import User
from app.schemas.system import HealthCheckResponse, RuntimeInfo
from app.utils.response import success_response

logger = logging.getLogger(__name__)

# Track application start time
_start_time = time.monotonic()

router = APIRouter()


@router.get("/health")
async def health_check(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check health of MySQL, Redis, and MinIO."""
    # MySQL
    mysql_status = "ok"
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("MySQL health check failed")
        mysql_status = "error"

    # Redis
    redis_status = "ok"
    try:
        if redis_module.redis_client is not None:
            await redis_module.redis_client.ping()
        else:
            redis_status = "error"
    except Exception:
        logger.exception("Redis health check failed")
        redis_status = "error"

    # MinIO
    minio_ok = await minio_check_health()
    minio_status = "ok" if minio_ok else "error"

    data = HealthCheckResponse(
        app="ok",
        mysql=mysql_status,
        redis=redis_status,
        minio=minio_status,
        timestamp=datetime.now(timezone.utc),
    )
    return success_response(data.model_dump())


@router.get("/runtime")
async def runtime_info(
    current_user: User = Depends(require_permission("system:config")),
):
    """Return application runtime information."""
    uptime = time.monotonic() - _start_time
    data = RuntimeInfo(
        python_version=sys.version,
        app_version="1.0.0",
        app_name=settings.APP_NAME,
        environment=settings.APP_ENV,
        uptime_seconds=round(uptime, 2),
    )
    return success_response(data.model_dump())
