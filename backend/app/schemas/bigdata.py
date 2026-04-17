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


class MLPredictResponse(BaseModel):
    """Single-record ML inference result."""

    high_risk_prob: float
    high_risk: bool
    followup_prob: float
    followup_needed: bool
    health_score: float


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
