"""Analytics job runner (stub implementation)."""

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import BaseModel as _  # noqa: F401 — ensure Base is loaded

logger = logging.getLogger(__name__)


async def run_analytics_job(
    db: AsyncSession, job_type: str, date: Optional[str] = None
) -> dict:
    """Run an analytics job (stub).

    In production this would trigger a Spark/Flink job.
    Currently just marks the job as completed.

    Args:
        db: Async database session.
        job_type: Type of analytics job.
        date: Optional date parameter for the job.

    Returns:
        Result summary dict.
    """
    # Import here to avoid circular imports at module level
    from app.models.analytics import AnalyticsJob

    logger.info("Running analytics job: type=%s date=%s", job_type, date)

    result_summary = {
        "job_type": job_type,
        "date": date,
        "status": "completed",
        "message": "Stub implementation — no actual analysis performed",
    }

    # Find the job by type+date and update it
    from sqlalchemy import select

    stmt = select(AnalyticsJob).where(
        AnalyticsJob.job_type == job_type,
        AnalyticsJob.status == "pending",
        AnalyticsJob.deleted_at.is_(None),
    ).order_by(AnalyticsJob.created_at.desc())
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()

    if job:
        job.status = "completed"
        job.result_summary = result_summary
        await db.flush()
        await db.refresh(job)

    return result_summary
