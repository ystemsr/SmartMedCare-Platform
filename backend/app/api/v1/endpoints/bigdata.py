"""Big Data, Spark/Hive/HDFS proxy, and ML inference API endpoints."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.repositories.bigdata import (
    BigDataJobRepository,
    PredictionResultRepository,
)
from app.schemas.bigdata import (
    BigDataJobCreate,
    BigDataJobDetail,
    BigDataJobResponse,
    HiveQueryRequest,
    MLBatchPredictRequest,
    MLPredictResponse,
)
from app.services import hdfs_client, hive_client, ml_inference, spark_client
from app.services.analytics import AnalyticsService
from app.utils.pagination import PaginationParams
from app.utils.response import (
    NOT_FOUND,
    PARAM_ERROR,
    error_response,
    success_response,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------


@router.post("/jobs")
async def submit_job(
    body: BigDataJobCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("bigdata:run")),
):
    """Submit a big data / Spark / Hive job."""
    try:
        job = await spark_client.submit_job(
            db, body.job_type, body.params, submitted_by=current_user.id
        )
    except ValueError as e:
        return error_response(PARAM_ERROR, str(e))

    return success_response(
        data=BigDataJobResponse.model_validate(job).model_dump(mode="json")
    )


@router.get("/jobs")
async def list_jobs(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("bigdata:read")),
):
    """Paginated list of big data jobs."""
    page = await BigDataJobRepository.list_paginated(db, pagination)
    return success_response(data=page.model_dump(mode="json"))


@router.get("/jobs/{job_id}")
async def get_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("bigdata:read")),
):
    """Fetch job detail plus the last ~500 log lines."""
    job = await BigDataJobRepository.get_by_job_id(db, job_id)
    if job is None:
        return error_response(NOT_FOUND, "Job not found")
    log_tail = spark_client.read_log_tail(job.log_path, max_lines=500)
    detail = BigDataJobDetail.model_validate(
        {**BigDataJobResponse.model_validate(job).model_dump(), "log_tail": log_tail}
    )
    return success_response(data=detail.model_dump(mode="json"))


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("bigdata:run")),
):
    """Best-effort job cancel."""
    ok = await spark_client.cancel_job(db, job_id)
    if not ok:
        return error_response(NOT_FOUND, "Job not cancellable or not found")
    return success_response(data={"job_id": job_id, "status": "cancelled"})


# ---------------------------------------------------------------------------
# HDFS
# ---------------------------------------------------------------------------


@router.get("/hdfs/list")
async def hdfs_list(
    path: str = Query("/", description="HDFS path to list"),
    _user=Depends(require_permission("bigdata:read")),
):
    """Proxy WebHDFS LISTSTATUS."""
    try:
        result = await hdfs_client.list_path(path)
    except Exception as e:  # noqa: BLE001 — surface network / HDFS errors
        logger.warning("HDFS list failed: %s", e)
        return error_response(PARAM_ERROR, f"HDFS list failed: {e}")
    return success_response(data=result.model_dump(mode="json"))


@router.get("/hdfs/preview")
async def hdfs_preview(
    path: str = Query(..., description="HDFS file path"),
    lines: int = Query(200, ge=1, le=2000),
    _user=Depends(require_permission("bigdata:read")),
):
    """Return the head of an HDFS file."""
    try:
        result = await hdfs_client.read_file(path, lines=lines)
    except Exception as e:  # noqa: BLE001
        logger.warning("HDFS preview failed: %s", e)
        return error_response(PARAM_ERROR, f"HDFS preview failed: {e}")
    return success_response(data=result.model_dump(mode="json"))


# ---------------------------------------------------------------------------
# Hive
# ---------------------------------------------------------------------------


@router.post("/hive/query")
async def hive_query(
    body: HiveQueryRequest,
    _user=Depends(require_permission("bigdata:read")),
):
    """Execute a single SELECT / WITH query against Hive."""
    try:
        result = await hive_client.execute_select(body.sql, body.limit)
    except ValueError as e:
        return error_response(PARAM_ERROR, str(e))
    except Exception as e:  # noqa: BLE001
        logger.warning("Hive query failed: %s", e)
        return error_response(PARAM_ERROR, f"Hive query failed: {e}")
    return success_response(data=result.model_dump(mode="json"))


# ---------------------------------------------------------------------------
# ML inference
# ---------------------------------------------------------------------------


@router.post("/ml/predict")
async def ml_predict(
    features: dict = Body(..., description="Feature dict; missing keys default to 0"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("ml:predict")),
):
    """Single-record ML inference. If `features.elder_id` is supplied, persist the result."""
    if not isinstance(features, dict):
        return error_response(PARAM_ERROR, "features must be an object")

    elder_id = features.get("elder_id")
    try:
        prediction = ml_inference.predict(features)
    except FileNotFoundError:
        return error_response(
            PARAM_ERROR,
            f"ML model file not found at {ml_inference.model_path()}",
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("ML inference failed")
        return error_response(PARAM_ERROR, f"Inference failed: {e}")

    if isinstance(elder_id, (int, float)) and int(elder_id) > 0:
        await PredictionResultRepository.upsert_latest(
            db,
            int(elder_id),
            {
                **prediction,
                "predicted_at": datetime.now(timezone.utc),
            },
        )

    return success_response(data=MLPredictResponse(**prediction).model_dump())


@router.post("/ml/predict/batch")
async def ml_predict_batch(
    body: MLBatchPredictRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("ml:predict")),
):
    """Batch ML inference."""
    try:
        predictions = ml_inference.predict_batch(body.records)
    except FileNotFoundError:
        return error_response(
            PARAM_ERROR,
            f"ML model file not found at {ml_inference.model_path()}",
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("Batch ML inference failed")
        return error_response(PARAM_ERROR, f"Inference failed: {e}")

    now = datetime.now(timezone.utc)
    for rec, pred in zip(body.records, predictions):
        elder_id = rec.get("elder_id") if isinstance(rec, dict) else None
        if isinstance(elder_id, (int, float)) and int(elder_id) > 0:
            await PredictionResultRepository.upsert_latest(
                db,
                int(elder_id),
                {**pred, "predicted_at": now},
            )

    return success_response(
        data=[MLPredictResponse(**p).model_dump() for p in predictions]
    )


@router.get("/ml/predictions/{elder_id}")
async def get_latest_prediction(
    elder_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("ml:predict")),
):
    """Return the latest persisted prediction for an elder."""
    row = await PredictionResultRepository.get_latest_for_elder(db, elder_id)
    if row is None:
        return error_response(NOT_FOUND, "No prediction found for this elder")
    return success_response(
        data=PredictionResultRepository.to_response(row).model_dump(mode="json")
    )


# ---------------------------------------------------------------------------
# Analytics overview (Hive-first with MySQL fallback)
# ---------------------------------------------------------------------------


@router.get("/analytics/overview")
async def analytics_overview(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("bigdata:read")),
):
    """Return an analytics overview. Falls back to the MySQL-based
    analytics service when Hive marts are unavailable.
    """
    try:
        result = await hive_client.execute_select(
            "SELECT elder_total, high_risk_total, medium_risk_total, pending_alert_total "
            "FROM mart_overview LIMIT 1",
            limit=1,
        )
        if result.rows:
            row = result.rows[0]
            return success_response(
                data={
                    "source": "hive",
                    "elder_total": int(row[0] or 0),
                    "high_risk_total": int(row[1] or 0),
                    "medium_risk_total": int(row[2] or 0),
                    "pending_alert_total": int(row[3] or 0),
                }
            )
    except Exception as e:  # noqa: BLE001
        logger.info("Hive overview unavailable, falling back to MySQL: %s", e)

    overview = await AnalyticsService.get_overview(db)
    payload = overview.model_dump()
    payload["source"] = "mysql"
    return success_response(data=payload)
