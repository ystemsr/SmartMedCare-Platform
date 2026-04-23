"""Big Data, Spark/Hive/HDFS proxy, and ML inference API endpoints."""

import csv
import io
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.models.alert import Alert
from app.models.bigdata import BigDataJob, PredictionResult
from app.models.elder import Elder
from app.models.followup import Followup
from app.repositories.bigdata import (
    BigDataJobRepository,
    PredictionResultRepository,
)
from app.repositories.hive_history import (
    HiveQueryHistoryRepository,
    HiveSavedQueryRepository,
)
from app.schemas.bigdata import (
    BigDataJobCreate,
    BigDataJobDetail,
    BigDataJobResponse,
    HiveQueryHistoryResponse,
    HiveQueryRequest,
    HiveSavedQueryCreate,
    HiveSavedQueryResponse,
    HiveSavedQueryUpdate,
    MLFeaturePayload,
    PipelineFreshnessResponse,
    PipelineRunResponse,
    PipelineSchedule,
    PipelineScheduleUpdate,
    StageFreshness,
)
from app.tasks.pipeline_scheduler import (
    CFG_KEY_ENABLED,
    CFG_KEY_UTC_TIME,
    PipelineScheduler,
)
from app.models.audit_log import SystemConfig
from app.services import hdfs_client, hive_client, spark_client
from app.services.analytics import AnalyticsService
from app.services.feature_catalog import (
    build_feature_payload,
    public_catalog,
)
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
    status: Optional[str] = Query(None, description="Comma-separated statuses"),
    job_type: Optional[str] = Query(None, description="Comma-separated job types"),
    submitted_by: Optional[int] = Query(None, ge=1),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("bigdata:read")),
):
    """Paginated, filterable list of big data jobs."""
    page = await BigDataJobRepository.list_filtered(
        db,
        pagination,
        statuses=[s for s in (status or "").split(",") if s] or None,
        job_types=[t for t in (job_type or "").split(",") if t] or None,
        submitted_by=submitted_by,
        date_from=date_from,
        date_to=date_to,
    )
    return success_response(data=page.model_dump(mode="json"))


@router.post("/jobs/{job_id}/retry")
async def retry_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("bigdata:run")),
):
    """Clone a job's parameters and resubmit as a new job."""
    original = await BigDataJobRepository.get_by_job_id(db, job_id)
    if original is None:
        return error_response(NOT_FOUND, "Job not found")
    try:
        job = await spark_client.submit_job(
            db,
            original.job_type,
            original.params or {},
            submitted_by=current_user.id,
        )
    except ValueError as e:
        return error_response(PARAM_ERROR, str(e))
    return success_response(
        data=BigDataJobResponse.model_validate(job).model_dump(mode="json")
    )


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
# Pipeline — business-facing freshness and one-click run
# ---------------------------------------------------------------------------


_STAGE_META: dict[str, tuple[str, str]] = {
    "mysql_to_hdfs": (
        "业务库快照",
        "将老人、健康记录、医护记录、告警、随访、干预等业务数据同步到大数据存储",
    ),
    "build_marts": (
        "统计数据集市",
        "基于快照生成风险汇总、告警统计、随访完成率等宽表，给看板使用",
    ),
    "batch_predict": (
        "智能风险预测",
        "对所有老人批量运行 AI 模型，更新健康风险分数和建议",
    ),
}


def _format_freshness(seconds: Optional[int]) -> str:
    if seconds is None:
        return "从未运行"
    if seconds < 0:
        seconds = 0
    if seconds < 60:
        return "刚刚"
    if seconds < 3600:
        return f"{seconds // 60} 分钟前"
    if seconds < 86400:
        return f"{seconds // 3600} 小时前"
    return f"{seconds // 86400} 天前"


def _freshness_tone(status: str, seconds: Optional[int]) -> str:
    if status in {"running", "pending"}:
        return "running"
    if status == "failed":
        return "stale"
    if seconds is None:
        return "never"
    if seconds < 6 * 3600:
        return "fresh"
    if seconds < 24 * 3600:
        return "aging"
    return "stale"


@router.get("/pipeline/freshness")
async def pipeline_freshness(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("bigdata:read")),
):
    """Business-facing snapshot freshness for the three-stage pipeline."""
    now = datetime.now(timezone.utc)
    stages: list[StageFreshness] = []
    has_running = False
    running_stage: Optional[str] = None
    running_run_id: Optional[str] = None

    for stage in spark_client.PIPELINE_STAGES:
        latest = await BigDataJobRepository.latest_by_stage(db, stage)
        display_name, description = _STAGE_META[stage]

        if latest is None:
            stages.append(
                StageFreshness(
                    stage=stage,
                    display_name=display_name,
                    description=description,
                    status="missing",
                    freshness_label="从未运行",
                    freshness_tone="never",
                )
            )
            continue

        # Use finished_at for succeeded jobs; otherwise started_at/created_at to
        # reflect in-flight work.
        ref_ts = latest.finished_at or latest.started_at or latest.created_at
        seconds: Optional[int] = None
        if ref_ts is not None and latest.status == "succeeded":
            ref_aware = ref_ts if ref_ts.tzinfo else ref_ts.replace(tzinfo=timezone.utc)
            seconds = max(0, int((now - ref_aware).total_seconds()))

        if latest.status in {"pending", "running"}:
            has_running = True
            running_stage = stage
            rid = (latest.params or {}).get("pipeline_run_id")
            if rid:
                running_run_id = rid

        label = (
            "运行中"
            if latest.status in {"pending", "running"}
            else _format_freshness(seconds)
        )
        tone = _freshness_tone(latest.status, seconds)

        stages.append(
            StageFreshness(
                stage=stage,
                display_name=display_name,
                description=description,
                status=latest.status,
                job_id=latest.job_id,
                finished_at=latest.finished_at,
                duration_ms=latest.duration_ms,
                rows_processed=latest.rows_processed,
                freshness_seconds=seconds,
                freshness_label=label,
                freshness_tone=tone,
            )
        )

    schedule = PipelineSchedule(**PipelineScheduler.config_snapshot())
    payload = PipelineFreshnessResponse(
        stages=stages,
        has_running_pipeline=has_running,
        pipeline_run_id=running_run_id,
        running_stage=running_stage,
        schedule=schedule,
    )
    return success_response(data=payload.model_dump(mode="json"))


_UTC_TIME_RE = __import__("re").compile(r"^([01]\d|2[0-3]):[0-5]\d$")


@router.put("/pipeline/schedule")
async def update_pipeline_schedule(
    body: PipelineScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("system:config")),
):
    """Admin-only: update the daily pipeline schedule.

    `utc_time` is HH:MM in UTC. The frontend is expected to convert the admin's
    device-local selection to UTC before sending.
    """
    if not _UTC_TIME_RE.match(body.utc_time or ""):
        return error_response(PARAM_ERROR, "utc_time must match HH:MM in 24h UTC")

    async def _upsert(key: str, value: str) -> None:
        existing = (
            await db.execute(select(SystemConfig).where(SystemConfig.config_key == key))
        ).scalar_one_or_none()
        if existing is None:
            db.add(SystemConfig(config_key=key, config_value=value))
        else:
            existing.config_value = value

    await _upsert(CFG_KEY_ENABLED, "true" if body.enabled else "false")
    await _upsert(CFG_KEY_UTC_TIME, body.utc_time)
    await db.commit()

    await PipelineScheduler.reload()
    return success_response(data=PipelineScheduler.config_snapshot())


@router.post("/pipeline/run")
async def pipeline_run(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("bigdata:run")),
):
    """Trigger the full three-stage pipeline. Idempotent while a run is in flight."""
    try:
        run_id, reused = await spark_client.submit_pipeline(
            db, submitted_by=current_user.id
        )
    except ValueError as e:
        return error_response(PARAM_ERROR, str(e))
    jobs = await BigDataJobRepository.list_by_pipeline_run_id(db, run_id)
    payload = PipelineRunResponse(
        pipeline_run_id=run_id,
        job_ids=[j.job_id for j in jobs],
        reused=reused,
    )
    return success_response(data=payload.model_dump(mode="json"))


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


@router.get("/jobs/{job_id}/log")
async def download_job_log(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("bigdata:read")),
):
    """Download the full job log as text/plain."""
    job = await BigDataJobRepository.get_by_job_id(db, job_id)
    if job is None:
        return error_response(NOT_FOUND, "Job not found")
    from pathlib import Path

    p = Path(job.log_path) if job.log_path else None
    if not p or not p.exists():
        return error_response(NOT_FOUND, "Log file not found")

    def _stream():
        with p.open("r", encoding="utf-8", errors="replace") as f:
            while True:
                chunk = f.read(8192)
                if not chunk:
                    break
                yield chunk

    return StreamingResponse(
        _stream(),
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{job_id}.log"',
        },
    )


# ---------------------------------------------------------------------------
# Hive
# ---------------------------------------------------------------------------


@router.post("/hive/query")
async def hive_query(
    body: HiveQueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("bigdata:read")),
):
    """Execute a single SELECT / WITH query against Hive. Writes to history."""
    started = time.monotonic()
    status = "success"
    error_message: Optional[str] = None
    row_count = 0
    try:
        result = await hive_client.execute_select(body.sql, body.limit)
        row_count = len(result.rows)
    except ValueError as e:
        status = "failed"
        error_message = str(e)
    except Exception as e:  # noqa: BLE001
        logger.warning("Hive query failed: %s", e)
        status = "failed"
        error_message = str(e)

    duration_ms = int((time.monotonic() - started) * 1000)
    await HiveQueryHistoryRepository.create(
        db,
        user_id=current_user.id,
        sql=body.sql,
        row_count=row_count,
        duration_ms=duration_ms,
        status=status,
        error_message=error_message,
    )

    if status != "success":
        return error_response(PARAM_ERROR, error_message or "Hive query failed")

    payload = result.model_dump(mode="json")
    payload["duration_ms"] = duration_ms
    payload["truncated"] = row_count >= body.limit
    return success_response(data=payload)


@router.post("/hive/export")
async def hive_export(
    body: HiveQueryRequest,
    current_user=Depends(require_permission("bigdata:read")),
):
    """Execute a SELECT query and stream the results as CSV."""
    try:
        result = await hive_client.execute_select(body.sql, body.limit)
    except ValueError as e:
        return error_response(PARAM_ERROR, str(e))
    except Exception as e:  # noqa: BLE001
        logger.warning("Hive export failed: %s", e)
        return error_response(PARAM_ERROR, f"Hive export failed: {e}")

    def _stream():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(result.columns)
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)
        for row in result.rows:
            writer.writerow(["" if c is None else c for c in row])
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    filename = f"hive_export_{int(time.time())}.csv"
    return StreamingResponse(
        _stream(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/hive/history")
async def hive_history(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("bigdata:read")),
):
    """Return recent Hive queries executed by the current user."""
    rows = await HiveQueryHistoryRepository.list_for_user(db, current_user.id, limit)
    items = [HiveQueryHistoryResponse.model_validate(r).model_dump(mode="json") for r in rows]
    return success_response(data={"items": items, "total": len(items)})


@router.get("/hive/saved")
async def hive_saved_list(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("bigdata:read")),
):
    rows = await HiveSavedQueryRepository.list_for_user(db, current_user.id)
    items = [HiveSavedQueryResponse.model_validate(r).model_dump(mode="json") for r in rows]
    return success_response(data={"items": items, "total": len(items)})


@router.post("/hive/saved")
async def hive_saved_create(
    body: HiveSavedQueryCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("bigdata:read")),
):
    row = await HiveSavedQueryRepository.create(
        db,
        user_id=current_user.id,
        name=body.name,
        sql=body.sql,
        description=body.description,
    )
    return success_response(
        data=HiveSavedQueryResponse.model_validate(row).model_dump(mode="json")
    )


@router.put("/hive/saved/{saved_id}")
async def hive_saved_update(
    saved_id: int,
    body: HiveSavedQueryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("bigdata:read")),
):
    row = await HiveSavedQueryRepository.get_by_id(db, saved_id, current_user.id)
    if row is None:
        return error_response(NOT_FOUND, "Saved query not found")
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        row = await HiveSavedQueryRepository.update(db, row, updates)
    return success_response(
        data=HiveSavedQueryResponse.model_validate(row).model_dump(mode="json")
    )


@router.delete("/hive/saved/{saved_id}")
async def hive_saved_delete(
    saved_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("bigdata:read")),
):
    row = await HiveSavedQueryRepository.get_by_id(db, saved_id, current_user.id)
    if row is None:
        return error_response(NOT_FOUND, "Saved query not found")
    await HiveSavedQueryRepository.soft_delete(db, row)
    return success_response(data={"id": saved_id, "deleted": True})


# ---------------------------------------------------------------------------
# ML inference
# ---------------------------------------------------------------------------


@router.get("/ml/catalog")
async def ml_catalog(
    _user=Depends(require_permission("ml:predict")),
):
    """Return the 20-feature catalog with labels, descriptions, and UI types."""
    return success_response(data={"items": public_catalog()})


@router.get("/ml/features/{elder_id}")
async def ml_features_for_elder(
    elder_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("ml:predict")),
):
    """Build autofilled feature payload for an elder; returns sources and gaps."""
    payload = await build_feature_payload(db, elder_id)
    return success_response(
        data=MLFeaturePayload(elder_id=elder_id, **payload).model_dump(mode="json")
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


@router.get("/ml/predictions/{elder_id}/history")
async def get_prediction_history(
    elder_id: int,
    limit: int = Query(30, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("ml:predict")),
):
    """Return historical predictions (newest first) for time-series charts."""
    rows = await PredictionResultRepository.list_history_for_elder(db, elder_id, limit)
    items = [
        PredictionResultRepository.to_response(r).model_dump(mode="json") for r in rows
    ]
    return success_response(data={"items": items, "total": len(items)})


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


# ---------------------------------------------------------------------------
# Analytics — multi-dim dashboard charts (MySQL-backed)
# ---------------------------------------------------------------------------


@router.get("/analytics/risk-distribution")
async def analytics_risk_distribution(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("bigdata:analytics")),
):
    """Distribution of elders by latest health_score bucket."""
    buckets = await PredictionResultRepository.risk_distribution(db)
    # Preserve a canonical ordering so the frontend can zip directly.
    order = ["low", "medium", "high", "critical"]
    labels = {
        "low": "低风险 (≥80)",
        "medium": "中风险 (60-80)",
        "high": "高风险 (40-60)",
        "critical": "极高风险 (<40)",
    }
    items = [
        {"key": k, "label": labels[k], "count": int(buckets.get(k, 0))} for k in order
    ]
    total = sum(i["count"] for i in items)
    return success_response(data={"items": items, "total": total})


@router.get("/analytics/followup-completion")
async def analytics_followup_completion(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("bigdata:analytics")),
):
    """Daily follow-up completion counts for the last N days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(
            func.date(Followup.updated_at).label("d"),
            Followup.status,
            func.count(),
        )
        .where(Followup.created_at >= since, Followup.deleted_at.is_(None))
        .group_by("d", Followup.status)
    )
    rows = (await db.execute(stmt)).all()
    series: dict[str, dict] = {}
    for d, status, cnt in rows:
        key = d.isoformat() if hasattr(d, "isoformat") else str(d)
        series.setdefault(key, {"date": key, "todo": 0, "in_progress": 0, "completed": 0})
        if status in series[key]:
            series[key][status] = int(cnt)
    items = sorted(series.values(), key=lambda x: x["date"])
    return success_response(data={"items": items, "days": days})


@router.get("/analytics/regional-breakdown")
async def analytics_regional_breakdown(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("bigdata:analytics")),
):
    """Elder count per region (first 4 chars of address, best-effort)."""
    stmt = (
        select(func.substr(Elder.address, 1, 6).label("region"), func.count())
        .where(Elder.deleted_at.is_(None), Elder.address != "")
        .group_by("region")
        .order_by(func.count().desc())
        .limit(20)
    )
    rows = (await db.execute(stmt)).all()
    items = [
        {"region": r[0] or "未填写", "count": int(r[1])} for r in rows
    ]
    return success_response(data={"items": items})


@router.get("/analytics/alert-response-time")
async def analytics_alert_response_time(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("bigdata:analytics")),
):
    """Average hours from alert trigger to last update (ack/resolve), by risk level."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    diff_seconds = func.unix_timestamp(Alert.updated_at) - func.unix_timestamp(
        Alert.triggered_at
    )
    stmt = (
        select(
            Alert.risk_level,
            (func.avg(diff_seconds) / 3600.0).label("avg_hours"),
            func.count(),
        )
        .where(
            Alert.deleted_at.is_(None),
            Alert.created_at >= since,
            Alert.status.in_(["acknowledged", "resolved"]),
            Alert.triggered_at.isnot(None),
        )
        .group_by(Alert.risk_level)
    )
    try:
        rows = (await db.execute(stmt)).all()
    except Exception as e:  # noqa: BLE001 — SQL dialect or schema gap
        logger.warning("alert response-time query failed: %s", e)
        rows = []

    items = [
        {"risk_level": r[0] or "unknown", "avg_hours": float(r[1] or 0), "count": int(r[2])}
        for r in rows
    ]
    return success_response(data={"items": items, "days": days})


@router.get("/analytics/pipeline-health")
async def analytics_pipeline_health(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("bigdata:analytics")),
):
    """Latest status of each critical pipeline stage within the last 24h."""
    since = datetime.now(timezone.utc) - timedelta(hours=36)
    stages = ["mysql_to_hdfs", "build_marts", "batch_predict"]
    items = []
    for stage in stages:
        stmt = (
            select(BigDataJob)
            .where(
                BigDataJob.job_type == stage,
                BigDataJob.created_at >= since,
                BigDataJob.deleted_at.is_(None),
            )
            .order_by(BigDataJob.created_at.desc())
            .limit(1)
        )
        row = (await db.execute(stmt)).scalar_one_or_none()
        if row is None:
            items.append({"stage": stage, "status": "missing", "job_id": None})
        else:
            items.append(
                {
                    "stage": stage,
                    "status": row.status,
                    "job_id": row.job_id,
                    "duration_ms": row.duration_ms,
                    "rows_processed": row.rows_processed,
                    "finished_at": row.finished_at.isoformat() if row.finished_at else None,
                }
            )
    return success_response(data={"items": items})


@router.get("/analytics/prediction-trend")
async def analytics_prediction_trend(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("bigdata:analytics")),
):
    """Daily average health_score and high_risk count across all elders."""
    from sqlalchemy import Integer

    since = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(
            func.date(PredictionResult.predicted_at).label("d"),
            func.avg(PredictionResult.health_score),
            func.sum(func.cast(PredictionResult.high_risk, Integer)),
            func.count(),
        )
        .where(
            PredictionResult.deleted_at.is_(None),
            PredictionResult.predicted_at >= since,
        )
        .group_by("d")
        .order_by("d")
    )
    rows = (await db.execute(stmt)).all()
    items = [
        {
            "date": d.isoformat() if hasattr(d, "isoformat") else str(d),
            "avg_health_score": round(float(avg or 0), 2),
            "high_risk_count": int(hr or 0),
            "total": int(total or 0),
        }
        for d, avg, hr, total in rows
    ]
    return success_response(data={"items": items, "days": days})
