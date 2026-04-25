"""Repository for BigDataJob and PredictionResult models."""

import logging
from typing import Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bigdata import BigDataJob, PredictionResult
from app.schemas.bigdata import BigDataJobResponse, PredictionResultResponse
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)


class BigDataJobRepository:
    """CRUD for bigdata_jobs."""

    @staticmethod
    async def create(db: AsyncSession, data: dict) -> BigDataJob:
        job = BigDataJob(**data)
        db.add(job)
        await db.flush()
        await db.refresh(job)
        return job

    @staticmethod
    async def get_by_job_id(db: AsyncSession, job_id: str) -> Optional[BigDataJob]:
        stmt = select(BigDataJob).where(
            BigDataJob.job_id == job_id, BigDataJob.deleted_at.is_(None)
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def list_paginated(db: AsyncSession, pagination: PaginationParams):
        query = select(BigDataJob).where(BigDataJob.deleted_at.is_(None))
        return await paginate(query, db, pagination, BigDataJobResponse)

    @staticmethod
    async def list_filtered(
        db: AsyncSession,
        pagination: PaginationParams,
        *,
        statuses: Optional[list[str]] = None,
        job_types: Optional[list[str]] = None,
        submitted_by: Optional[int] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ):
        query = select(BigDataJob).where(BigDataJob.deleted_at.is_(None))
        if statuses:
            query = query.where(BigDataJob.status.in_(statuses))
        if job_types:
            query = query.where(BigDataJob.job_type.in_(job_types))
        if submitted_by is not None:
            query = query.where(BigDataJob.submitted_by == submitted_by)
        if date_from:
            query = query.where(BigDataJob.created_at >= date_from)
        if date_to:
            query = query.where(BigDataJob.created_at <= date_to)
        return await paginate(query, db, pagination, BigDataJobResponse)

    @staticmethod
    async def count_recent_by_status(
        db: AsyncSession, since, job_types: Optional[list[str]] = None
    ) -> dict[str, int]:
        from sqlalchemy import func

        stmt = (
            select(BigDataJob.status, func.count())
            .where(
                BigDataJob.deleted_at.is_(None),
                BigDataJob.created_at >= since,
            )
            .group_by(BigDataJob.status)
        )
        if job_types:
            stmt = stmt.where(BigDataJob.job_type.in_(job_types))
        rows = (await db.execute(stmt)).all()
        return {r[0]: int(r[1]) for r in rows}

    @staticmethod
    async def update(db: AsyncSession, job: BigDataJob, data: dict) -> BigDataJob:
        for k, v in data.items():
            setattr(job, k, v)
        await db.flush()
        await db.refresh(job)
        return job

    @staticmethod
    async def latest_by_stage(
        db: AsyncSession, job_type: str
    ) -> Optional[BigDataJob]:
        """Latest (non-deleted) job of a given type, regardless of status."""
        stmt = (
            select(BigDataJob)
            .where(
                BigDataJob.job_type == job_type,
                BigDataJob.deleted_at.is_(None),
            )
            .order_by(desc(BigDataJob.created_at))
            .limit(1)
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def find_running_pipeline(
        db: AsyncSession,
    ) -> Optional[BigDataJob]:
        """Return any job belonging to a pipeline_run_id and currently in flight.

        Used for idempotent pipeline submission: if a pipeline is already
        running (pending or running status), we reuse its run id instead of
        starting a new chain.
        """
        from sqlalchemy import func

        run_id_expr = func.json_unquote(
            func.json_extract(BigDataJob.params, "$.pipeline_run_id")
        )
        stmt = (
            select(BigDataJob)
            .where(
                BigDataJob.deleted_at.is_(None),
                BigDataJob.status.in_(["pending", "running"]),
                run_id_expr.isnot(None),
            )
            .order_by(desc(BigDataJob.created_at))
            .limit(1)
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def list_by_pipeline_run_id(
        db: AsyncSession, pipeline_run_id: str
    ) -> list[BigDataJob]:
        """Return every job tagged with the given pipeline_run_id, oldest first."""
        from sqlalchemy import func

        run_id_expr = func.json_unquote(
            func.json_extract(BigDataJob.params, "$.pipeline_run_id")
        )
        stmt = (
            select(BigDataJob)
            .where(
                BigDataJob.deleted_at.is_(None),
                run_id_expr == pipeline_run_id,
            )
            .order_by(BigDataJob.created_at.asc())
        )
        return list((await db.execute(stmt)).scalars().all())


class PredictionResultRepository:
    """CRUD for prediction_results."""

    @staticmethod
    async def upsert_latest(
        db: AsyncSession, elder_id: int, data: dict
    ) -> PredictionResult:
        """Insert a new prediction row. Historical rows are kept; queries read the latest."""
        row = PredictionResult(elder_id=elder_id, **data)
        db.add(row)
        await db.flush()
        await db.refresh(row)
        return row

    @staticmethod
    async def get_latest_for_elder(
        db: AsyncSession, elder_id: int
    ) -> Optional[PredictionResult]:
        stmt = (
            select(PredictionResult)
            .where(
                PredictionResult.elder_id == elder_id,
                PredictionResult.deleted_at.is_(None),
            )
            .order_by(desc(PredictionResult.predicted_at))
            .limit(1)
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def get_latest_for_elders(
        db: AsyncSession, elder_ids: list[int]
    ) -> dict[int, PredictionResult]:
        """Batch-fetch the latest prediction per elder for the given ids.

        Uses a correlated subquery selecting max(predicted_at) per elder so
        list endpoints avoid an N+1 query.
        """
        if not elder_ids:
            return {}

        from sqlalchemy import and_, func

        subq = (
            select(
                PredictionResult.elder_id.label("eid"),
                func.max(PredictionResult.predicted_at).label("max_at"),
            )
            .where(
                PredictionResult.elder_id.in_(elder_ids),
                PredictionResult.deleted_at.is_(None),
            )
            .group_by(PredictionResult.elder_id)
            .subquery()
        )
        stmt = select(PredictionResult).join(
            subq,
            and_(
                PredictionResult.elder_id == subq.c.eid,
                PredictionResult.predicted_at == subq.c.max_at,
            ),
        )
        rows = (await db.execute(stmt)).scalars().all()
        return {row.elder_id: row for row in rows}

    @staticmethod
    async def list_history_for_elder(
        db: AsyncSession, elder_id: int, limit: int = 30
    ) -> list[PredictionResult]:
        stmt = (
            select(PredictionResult)
            .where(
                PredictionResult.elder_id == elder_id,
                PredictionResult.deleted_at.is_(None),
            )
            .order_by(desc(PredictionResult.predicted_at))
            .limit(limit)
        )
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def risk_distribution(db: AsyncSession) -> dict:
        """Return counts of elders bucketed by health_score of latest prediction."""
        from sqlalchemy import and_, case, func

        subq = (
            select(
                PredictionResult.elder_id.label("eid"),
                func.max(PredictionResult.predicted_at).label("max_at"),
            )
            .where(PredictionResult.deleted_at.is_(None))
            .group_by(PredictionResult.elder_id)
            .subquery()
        )
        bucket = case(
            (PredictionResult.health_score >= 80, "low"),
            (PredictionResult.health_score >= 60, "medium"),
            (PredictionResult.health_score >= 40, "high"),
            else_="critical",
        )
        stmt = (
            select(bucket.label("bucket"), func.count())
            .join(
                subq,
                and_(
                    PredictionResult.elder_id == subq.c.eid,
                    PredictionResult.predicted_at == subq.c.max_at,
                ),
            )
            .group_by("bucket")
        )
        rows = (await db.execute(stmt)).all()
        return {r[0]: int(r[1]) for r in rows}

    @staticmethod
    def to_response(row: PredictionResult) -> PredictionResultResponse:
        return PredictionResultResponse.model_validate(row)
