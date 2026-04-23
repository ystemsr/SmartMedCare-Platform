"""Spark job submission client.

Submits jobs by shelling out to `docker exec` on the Spark master container,
invoking `spark-submit` on scripts delivered by Block B under
`/opt/spark-apps/spark/<job>.py`. The job is launched as a background asyncio
task; stdout/stderr are streamed to a log file under `SPARK_LOG_DIR`.
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.bigdata import BigDataJob

logger = logging.getLogger(__name__)


JOB_TYPES = {
    "mysql_to_hdfs": "mysql_to_hdfs.py",
    "build_marts": "build_marts.py",
    "batch_predict": "batch_predict.py",
}


def _spark_container() -> str:
    return os.environ.get("SPARK_CONTAINER", "smartmedcare-spark-master")


def _spark_master_url() -> str:
    return os.environ.get("SPARK_MASTER_URL", "spark://spark-master:7077")


def _log_dir() -> Path:
    p = Path(os.environ.get("SPARK_LOG_DIR", "/tmp/bigdata-jobs"))
    p.mkdir(parents=True, exist_ok=True)
    return p


def _apps_dir() -> str:
    return os.environ.get("SPARK_APPS_DIR", "/opt/spark-apps")


def _docker_socket_path() -> str:
    return os.environ.get("DOCKER_HOST_SOCKET", "/var/run/docker.sock")


def _preflight_error() -> Optional[str]:
    """Return an English error string if this host cannot launch spark jobs.

    Job submission shells out to `docker exec <spark-master> spark-submit ...`,
    so we need (1) the docker CLI on PATH and (2) the docker socket reachable.
    Without these, `asyncio.create_subprocess_exec` fails with a bare
    "[Errno 2] No such file or directory" that is impossible to debug from the
    UI log tail. Checking here turns that into a 400 on the submit endpoint.
    """
    if shutil.which("docker") is None:
        return (
            "Spark job submission requires the 'docker' CLI in the backend "
            "container. Rebuild the backend image so docker.io is installed: "
            "docker compose up -d --build backend"
        )
    sock = _docker_socket_path()
    if not os.path.exists(sock):
        return (
            f"Docker socket not mounted at {sock}. Ensure docker-compose.yml "
            "mounts /var/run/docker.sock into the backend service."
        )
    return None


def new_job_id() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"bd_{ts}_{uuid.uuid4().hex[:8]}"


def resolve_script(job_type: str) -> Optional[str]:
    """Return the script filename for a known job_type, or None if unsupported."""
    return JOB_TYPES.get(job_type)


def _build_command(job_type: str, params: dict[str, Any] | None) -> list[str]:
    """Construct the `docker exec ... spark-submit ...` command."""
    script = resolve_script(job_type)
    if script is None:
        raise ValueError(f"Unknown job_type: {job_type}")

    container = _spark_container()
    master = _spark_master_url()
    remote_script = f"{_apps_dir()}/spark/{script}"

    args: list[str] = []
    if params:
        for k, v in params.items():
            if v is None:
                continue
            args.extend([f"--{k}", str(v)])

    return [
        "docker", "exec", container,
        "spark-submit",
        "--master", master,
        "--deploy-mode", "client",
        remote_script,
        *args,
    ]


async def _update_job(job_id: str, data: dict) -> None:
    """Update a job row using an independent session."""
    async with AsyncSessionLocal() as db:
        from app.repositories.bigdata import BigDataJobRepository
        job = await BigDataJobRepository.get_by_job_id(db, job_id)
        if job is None:
            logger.warning("Job %s not found during update", job_id)
            return
        for k, v in data.items():
            setattr(job, k, v)
        await db.commit()


async def _run_and_track(job_id: str, cmd: list[str], log_path: str) -> None:
    """Run the command and track status in DB. Captures stdout+stderr to log_path."""
    started_at = datetime.now(timezone.utc)
    await _update_job(
        job_id,
        {"status": "running", "started_at": started_at},
    )

    try:
        with open(log_path, "w", encoding="utf-8") as log_f:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=log_f,
                stderr=asyncio.subprocess.STDOUT,
            )
            returncode = await proc.wait()
    except (OSError, FileNotFoundError) as e:
        logger.exception("Failed to launch spark job %s", job_id)
        finished_at = datetime.now(timezone.utc)
        await _update_job(
            job_id,
            {
                "status": "failed",
                "finished_at": finished_at,
                "duration_ms": int(
                    (finished_at - started_at).total_seconds() * 1000
                ),
            },
        )
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(
                    f"\nERROR launching job: {e}\n"
                    f"Command: {' '.join(cmd)}\n"
                    "Hint: the backend container must have the 'docker' CLI "
                    "installed and /var/run/docker.sock mounted so it can "
                    "reach the Spark master container.\n"
                )
        except OSError:
            pass
        return

    finished_at = datetime.now(timezone.utc)
    status = "succeeded" if returncode == 0 else "failed"
    rows_processed = _parse_rows_from_log(log_path)
    await _update_job(
        job_id,
        {
            "status": status,
            "finished_at": finished_at,
            "duration_ms": int((finished_at - started_at).total_seconds() * 1000),
            "rows_processed": rows_processed,
        },
    )
    logger.info("Job %s finished with status=%s rc=%s", job_id, status, returncode)


def _parse_rows_from_log(log_path: str) -> Optional[int]:
    """Best-effort: scan the log tail for a 'rows_processed=N' hint."""
    import re

    try:
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()[-8192:]
    except OSError:
        return None
    matches = re.findall(r"rows_processed[=:]\s*(\d+)", content, re.IGNORECASE)
    if not matches:
        return None
    try:
        return int(matches[-1])
    except ValueError:
        return None


async def submit_job(
    db: AsyncSession,
    job_type: str,
    params: Optional[dict],
    submitted_by: Optional[int],
) -> BigDataJob:
    """Create a BigDataJob row and launch the command in the background."""
    if resolve_script(job_type) is None:
        raise ValueError(f"Unsupported job_type: {job_type}")

    preflight = _preflight_error()
    if preflight:
        raise ValueError(preflight)

    job_id = new_job_id()
    log_path = str(_log_dir() / f"{job_id}.log")

    from app.repositories.bigdata import BigDataJobRepository
    job = await BigDataJobRepository.create(
        db,
        {
            "job_id": job_id,
            "job_type": job_type,
            "status": "pending",
            "params": params or {},
            "log_path": log_path,
            "submitted_by": submitted_by,
        },
    )

    cmd = _build_command(job_type, params)
    logger.info("Submitting spark job %s: %s", job_id, " ".join(cmd))

    # Fire-and-forget background task; do not await.
    asyncio.create_task(_run_and_track(job_id, cmd, log_path))
    return job


async def cancel_job(db: AsyncSession, job_id: str) -> bool:
    """Best-effort cancel: marks the DB row as cancelled.

    Killing the underlying spark-submit process from a different request is
    out of scope here — we rely on Spark's own cancellation UI / YARN kill.
    """
    from app.repositories.bigdata import BigDataJobRepository
    job = await BigDataJobRepository.get_by_job_id(db, job_id)
    if job is None:
        return False
    if job.status in ("succeeded", "failed", "cancelled"):
        return False
    job.status = "cancelled"
    job.finished_at = datetime.now(timezone.utc)
    await db.flush()
    return True


PIPELINE_STAGES: list[str] = ["mysql_to_hdfs", "build_marts", "batch_predict"]


def new_pipeline_run_id() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"plr_{ts}_{uuid.uuid4().hex[:8]}"


async def _submit_stage(
    pipeline_run_id: str,
    stage_index: int,
    job_type: str,
    submitted_by: Optional[int],
) -> BigDataJob:
    """Create a BigDataJob row for one stage inside a pipeline run."""
    async with AsyncSessionLocal() as db:
        from app.repositories.bigdata import BigDataJobRepository

        job_id = new_job_id()
        log_path = str(_log_dir() / f"{job_id}.log")
        job = await BigDataJobRepository.create(
            db,
            {
                "job_id": job_id,
                "job_type": job_type,
                "status": "pending",
                "params": {
                    "pipeline_run_id": pipeline_run_id,
                    "pipeline_stage_index": stage_index,
                },
                "log_path": log_path,
                "submitted_by": submitted_by,
            },
        )
        await db.commit()
        return job


async def _run_pipeline_chain(
    pipeline_run_id: str, submitted_by: Optional[int]
) -> None:
    """Run the three pipeline stages sequentially. Abort chain on first failure."""
    logger.info("Pipeline %s starting", pipeline_run_id)
    for idx, stage in enumerate(PIPELINE_STAGES):
        job = await _submit_stage(pipeline_run_id, idx, stage, submitted_by)
        cmd = _build_command(stage, None)
        logger.info(
            "Pipeline %s stage %s job=%s cmd=%s",
            pipeline_run_id,
            stage,
            job.job_id,
            " ".join(cmd),
        )
        await _run_and_track(job.job_id, cmd, job.log_path)

        # Re-read to check final status; abort chain if this stage did not succeed.
        async with AsyncSessionLocal() as db:
            from app.repositories.bigdata import BigDataJobRepository

            refreshed = await BigDataJobRepository.get_by_job_id(db, job.job_id)
            final_status = refreshed.status if refreshed else "failed"

        if final_status != "succeeded":
            logger.warning(
                "Pipeline %s aborted at stage %s (status=%s)",
                pipeline_run_id,
                stage,
                final_status,
            )
            return
    logger.info("Pipeline %s completed", pipeline_run_id)


async def submit_pipeline(
    db: AsyncSession, submitted_by: Optional[int]
) -> tuple[str, bool]:
    """Kick off the full three-stage pipeline.

    Idempotent: if any stage is already `pending`/`running` and belongs to a
    pipeline_run_id, that run is returned instead of starting a new chain.
    Returns (pipeline_run_id, reused).
    """
    from app.repositories.bigdata import BigDataJobRepository

    existing = await BigDataJobRepository.find_running_pipeline(db)
    if existing is not None:
        run_id = (existing.params or {}).get("pipeline_run_id")
        if run_id:
            logger.info("Reusing running pipeline run %s", run_id)
            return run_id, True

    preflight = _preflight_error()
    if preflight:
        raise ValueError(preflight)

    pipeline_run_id = new_pipeline_run_id()
    asyncio.create_task(_run_pipeline_chain(pipeline_run_id, submitted_by))
    return pipeline_run_id, False


def read_log_tail(log_path: str, max_lines: int = 500) -> list[str]:
    """Read the last `max_lines` lines from a log file."""
    if not log_path:
        return []
    p = Path(log_path)
    if not p.exists():
        return []
    try:
        with p.open("r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except OSError:
        return []
    tail = lines[-max_lines:]
    return [ln.rstrip("\n") for ln in tail]
