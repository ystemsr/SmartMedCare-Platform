"""Daily big-data pipeline scheduler.

Runs inside the FastAPI process as a single asyncio task. Each day at the
configured UTC time, it triggers `spark_client.submit_pipeline` which chains
mysql_to_hdfs → build_marts → batch_predict.

Config precedence (highest first):
    1. DB: `system_configs` rows with keys
       - pipeline.schedule.enabled   -> "true"/"false"
       - pipeline.schedule.utc_time  -> "HH:MM" (UTC)
    2. Environment (`.env`): PIPELINE_SCHEDULE_ENABLED / PIPELINE_SCHEDULE_UTC_TIME
       — bootstrap defaults before an admin saves anything.

The DB entries are written by the admin UI and read at every start/reload,
so a save from the frontend applies without a restart via `reload()`.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.audit_log import SystemConfig
from app.services import spark_client

logger = logging.getLogger(__name__)


# Config keys in system_configs
CFG_KEY_ENABLED = "pipeline.schedule.enabled"
CFG_KEY_UTC_TIME = "pipeline.schedule.utc_time"


class PipelineScheduler:
    """Singleton-style daily scheduler for the big-data pipeline."""

    _task: Optional[asyncio.Task] = None
    _next_run_at_utc: Optional[datetime] = None
    # Resolved runtime config (from DB if present, else env).
    _enabled: bool = False
    _utc_time: str = "19:00"  # placeholder; replaced in _load_config
    _source: str = "env"  # "db" or "env"

    # ---------------------------------------------------------------------
    # Public helpers
    # ---------------------------------------------------------------------

    @classmethod
    def next_run_at(cls) -> Optional[datetime]:
        return cls._next_run_at_utc

    @classmethod
    def config_snapshot(cls) -> dict:
        """Payload consumed by /bigdata/pipeline/freshness and the admin UI."""
        return {
            "enabled": cls._enabled,
            "utc_time": cls._utc_time,
            "source": cls._source,
            "next_run_at": cls._next_run_at_utc,
        }

    # ---------------------------------------------------------------------
    # Lifecycle
    # ---------------------------------------------------------------------

    @classmethod
    async def start(cls) -> None:
        await cls._load_config()
        if not cls._enabled:
            logger.info("Pipeline scheduler disabled by config")
            return
        if cls._task and not cls._task.done():
            return
        try:
            cls._parse_utc_time(cls._utc_time)
        except ValueError as e:
            logger.error("Pipeline scheduler utc_time invalid: %s", e)
            return
        cls._task = asyncio.create_task(cls._run_loop(), name="pipeline-scheduler")
        logger.info(
            "Pipeline scheduler started (daily at %s UTC, source=%s)",
            cls._utc_time,
            cls._source,
        )

    @classmethod
    async def stop(cls) -> None:
        if cls._task and not cls._task.done():
            cls._task.cancel()
            try:
                await cls._task
            except asyncio.CancelledError:
                pass
        cls._task = None
        cls._next_run_at_utc = None

    @classmethod
    async def reload(cls) -> None:
        """Apply a DB config change: stop the current loop and restart it."""
        logger.info("Pipeline scheduler reloading config")
        await cls.stop()
        await cls.start()

    # ---------------------------------------------------------------------
    # Config loading
    # ---------------------------------------------------------------------

    @classmethod
    async def _load_config(cls) -> None:
        """Populate _enabled / _utc_time / _source from DB → env fallback."""
        enabled: Optional[bool] = None
        utc_time: Optional[str] = None

        try:
            async with AsyncSessionLocal() as db:
                stmt = select(SystemConfig).where(
                    SystemConfig.config_key.in_([CFG_KEY_ENABLED, CFG_KEY_UTC_TIME])
                )
                rows = (await db.execute(stmt)).scalars().all()
                for row in rows:
                    if row.config_key == CFG_KEY_ENABLED:
                        enabled = (row.config_value or "").strip().lower() == "true"
                    elif row.config_key == CFG_KEY_UTC_TIME:
                        utc_time = (row.config_value or "").strip()
        except Exception:
            logger.exception("Pipeline scheduler DB config read failed; using env")

        if enabled is not None and utc_time:
            cls._enabled = enabled
            cls._utc_time = utc_time
            cls._source = "db"
            return

        # Fallback: use env-provided UTC HH:MM directly.
        cls._enabled = bool(settings.PIPELINE_SCHEDULE_ENABLED)
        env_utc = (settings.PIPELINE_SCHEDULE_UTC_TIME or "").strip()
        try:
            cls._parse_utc_time(env_utc)
            cls._utc_time = env_utc
        except ValueError as e:
            logger.warning(
                "PIPELINE_SCHEDULE_UTC_TIME invalid (%s); falling back to 19:00",
                e,
            )
            cls._utc_time = "19:00"
        cls._source = "env"

    # ---------------------------------------------------------------------
    # Internals
    # ---------------------------------------------------------------------

    @staticmethod
    def _parse_utc_time(value: str) -> tuple[int, int]:
        raw = (value or "").strip()
        parts = raw.split(":")
        if len(parts) != 2:
            raise ValueError(f"utc_time must be HH:MM, got {raw!r}")
        hour, minute = int(parts[0]), int(parts[1])
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            raise ValueError(f"utc_time out of range: {raw!r}")
        return hour, minute

    @classmethod
    def _compute_next_run_utc(cls, now_utc: datetime) -> datetime:
        hour, minute = cls._parse_utc_time(cls._utc_time)
        candidate = now_utc.replace(
            hour=hour, minute=minute, second=0, microsecond=0
        )
        if candidate <= now_utc:
            candidate = candidate + timedelta(days=1)
        return candidate

    @classmethod
    async def _trigger_once(cls) -> None:
        async with AsyncSessionLocal() as db:
            try:
                run_id, reused = await spark_client.submit_pipeline(
                    db, submitted_by=None
                )
            except Exception:
                logger.exception("Pipeline scheduler failed to submit run")
                return
        if reused:
            logger.info(
                "Pipeline scheduler skipped: existing run %s still in flight", run_id
            )
        else:
            logger.info("Pipeline scheduler triggered run %s", run_id)

    @classmethod
    async def _run_loop(cls) -> None:
        while True:
            now = datetime.now(ZoneInfo("UTC"))
            next_utc = cls._compute_next_run_utc(now)
            cls._next_run_at_utc = next_utc
            delay = max(1.0, (next_utc - now).total_seconds())
            try:
                await asyncio.sleep(delay)
            except asyncio.CancelledError:
                break
            await cls._trigger_once()
            # Small guard so consecutive firings in the same minute don't loop.
            await asyncio.sleep(1)
