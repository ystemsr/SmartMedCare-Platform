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
    async def update(db: AsyncSession, job: BigDataJob, data: dict) -> BigDataJob:
        for k, v in data.items():
            setattr(job, k, v)
        await db.flush()
        await db.refresh(job)
        return job


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
    def to_response(row: PredictionResult) -> PredictionResultResponse:
        return PredictionResultResponse.model_validate(row)
