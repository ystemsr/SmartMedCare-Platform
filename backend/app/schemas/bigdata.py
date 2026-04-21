"""Pydantic schemas for big data, Spark, Hive, HDFS, and ML inference endpoints."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---- Jobs ----

class BigDataJobCreate(BaseModel):
    """Request body to submit a big data job."""

    job_type: str = Field(
        ...,
        description="One of: mysql_to_hdfs, build_marts, batch_predict, custom_hive",
    )
    params: Optional[dict] = None


class BigDataJobResponse(BaseModel):
    """Big data job response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: str
    job_type: str
    status: str
    params: Optional[dict] = None
    log_path: str = ""
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    submitted_by: Optional[int] = None
    duration_ms: Optional[int] = None
    rows_processed: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class BigDataJobDetail(BigDataJobResponse):
    """Job detail with recent log lines."""

    log_tail: list[str] = Field(default_factory=list)


# ---- HDFS ----

class HdfsFileEntry(BaseModel):
    """A single entry returned from WebHDFS LISTSTATUS."""

    name: str
    type: str
    size: int = 0
    modified: Optional[int] = None
    owner: str = ""
    group: str = ""
    permission: str = ""


class HdfsListResponse(BaseModel):
    """HDFS directory listing response."""

    path: str
    entries: list[HdfsFileEntry]


class HdfsPreviewResponse(BaseModel):
    """HDFS file head preview."""

    path: str
    lines: list[str]
    truncated: bool = False


# ---- Hive ----

class HiveQueryRequest(BaseModel):
    """Hive SELECT query request."""

    sql: str
    limit: int = Field(200, ge=1, le=10000)


class HiveQueryResponse(BaseModel):
    """Hive query result."""

    columns: list[str]
    rows: list[list[Any]]


# ---- ML inference ----

class MLPredictRequest(BaseModel):
    """Single-record ML inference request. Unknown keys default to 0."""

    model_config = ConfigDict(extra="allow")

    features: dict[str, float] = Field(default_factory=dict)


class FeatureContribution(BaseModel):
    """Top-k attribution entry for a single feature."""

    key: str
    label: str
    value: float
    z_score: float
    direction: str  # "higher" | "lower"


class MLPredictResponse(BaseModel):
    """Single-record ML inference result."""

    high_risk_prob: float
    high_risk: bool
    followup_prob: float
    followup_needed: bool
    health_score: float
    contributions: Optional[list[FeatureContribution]] = None


class MLFeaturePayload(BaseModel):
    """Autofilled feature dict for an elder + gap list."""

    elder_id: int
    features: dict[str, Optional[float]] = Field(default_factory=dict)
    sources: dict[str, Optional[str]] = Field(default_factory=dict)
    missing: list[str] = Field(default_factory=list)


class HiveSavedQueryCreate(BaseModel):
    name: str = Field(..., max_length=128)
    sql: str
    description: Optional[str] = None


class HiveSavedQueryUpdate(BaseModel):
    name: Optional[str] = None
    sql: Optional[str] = None
    description: Optional[str] = None


class HiveSavedQueryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    name: str
    sql: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class HiveQueryHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    sql: str
    row_count: int
    duration_ms: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime


class MLBatchPredictRequest(BaseModel):
    """Batch ML inference request."""

    records: list[dict[str, float]]


class PredictionResultResponse(BaseModel):
    """Persisted prediction result row."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    elder_id: int
    high_risk_prob: float
    high_risk: bool
    followup_prob: float
    followup_needed: bool
    health_score: float
    predicted_at: datetime
    created_at: datetime
    updated_at: datetime


# ---- Pipeline freshness (business-facing wrapper over pipeline-health) ----


class StageFreshness(BaseModel):
    """Business-facing freshness summary for a single pipeline stage."""

    stage: str
    display_name: str
    description: str
    status: str
    job_id: Optional[str] = None
    finished_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    rows_processed: Optional[int] = None
    freshness_seconds: Optional[int] = None
    freshness_label: str
    freshness_tone: str  # "fresh" | "aging" | "stale" | "never" | "running"


class PipelineSchedule(BaseModel):
    """Declarative config of the daily auto-run. Source of truth is UTC."""

    enabled: bool
    utc_time: str  # "HH:MM" in UTC
    source: str  # "db" | "env"
    next_run_at: Optional[datetime] = None  # UTC


class PipelineScheduleUpdate(BaseModel):
    """Admin PUT body. utc_time is HH:MM in UTC (24h)."""

    enabled: bool
    utc_time: str


class PipelineFreshnessResponse(BaseModel):
    """Aggregated freshness for the three-stage pipeline."""

    stages: list[StageFreshness]
    has_running_pipeline: bool
    pipeline_run_id: Optional[str] = None
    running_stage: Optional[str] = None
    schedule: Optional[PipelineSchedule] = None


class PipelineRunResponse(BaseModel):
    """Result of submitting a one-click pipeline run."""

    pipeline_run_id: str
    job_ids: list[str]
    reused: bool  # True when an existing running pipeline was returned
