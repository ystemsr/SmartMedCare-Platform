"""Repository for prediction_tasks."""

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.elder import Elder
from app.models.prediction_task import PredictionTask
from app.models.user import User


# Task statuses.
STATUS_PENDING_ELDER = "pending_elder"
STATUS_PENDING_DOCTOR = "pending_doctor"
STATUS_PENDING_PREDICTION = "pending_prediction"
STATUS_PREDICTED = "predicted"
STATUS_FAILED = "failed"
STATUS_CANCELLED = "cancelled"

# Statuses where a task can still be edited / accept new inputs.
EDITABLE_STATUSES = (STATUS_PENDING_ELDER, STATUS_PENDING_DOCTOR)
OPEN_STATUSES = (
    STATUS_PENDING_ELDER,
    STATUS_PENDING_DOCTOR,
    STATUS_PENDING_PREDICTION,
)


class PredictionTaskRepository:
    """CRUD for prediction_tasks."""

    @staticmethod
    async def create(
        db: AsyncSession,
        *,
        elder_id: int,
        doctor_user_id: int,
        title: str,
        message: Optional[str],
        doctor_inputs: dict[str, Any],
        auto_inputs: dict[str, Any],
        permanent_inputs: dict[str, Any],
        elder_requested_fields: list[str],
        due_at: Optional[datetime] = None,
        status: str = STATUS_PENDING_ELDER,
    ) -> PredictionTask:
        task = PredictionTask(
            elder_id=elder_id,
            doctor_user_id=doctor_user_id,
            title=title,
            message=message,
            doctor_inputs=doctor_inputs or {},
            auto_inputs=auto_inputs or {},
            permanent_inputs=permanent_inputs or {},
            elder_requested_fields=elder_requested_fields,
            elder_inputs={},
            status=status,
            due_at=due_at,
        )
        db.add(task)
        await db.flush()
        await db.refresh(task)
        return task

    @staticmethod
    async def get_by_id(
        db: AsyncSession, task_id: int
    ) -> Optional[PredictionTask]:
        stmt = select(PredictionTask).where(
            PredictionTask.id == task_id, PredictionTask.deleted_at.is_(None)
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def list_for_doctor(
        db: AsyncSession,
        doctor_user_id: Optional[int] = None,
        elder_id: Optional[int] = None,
        status: Optional[list[str]] = None,
        limit: int = 200,
    ) -> list[PredictionTask]:
        stmt = select(PredictionTask).where(PredictionTask.deleted_at.is_(None))
        if doctor_user_id is not None:
            stmt = stmt.where(PredictionTask.doctor_user_id == doctor_user_id)
        if elder_id is not None:
            stmt = stmt.where(PredictionTask.elder_id == elder_id)
        if status:
            stmt = stmt.where(PredictionTask.status.in_(status))
        stmt = stmt.order_by(desc(PredictionTask.created_at)).limit(limit)
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def list_for_elder(
        db: AsyncSession,
        elder_id: int,
        status: Optional[list[str]] = None,
        limit: int = 100,
    ) -> list[PredictionTask]:
        stmt = select(PredictionTask).where(
            PredictionTask.elder_id == elder_id,
            PredictionTask.deleted_at.is_(None),
        )
        if status:
            stmt = stmt.where(PredictionTask.status.in_(status))
        stmt = stmt.order_by(desc(PredictionTask.created_at)).limit(limit)
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def save_elder_submission(
        db: AsyncSession,
        task: PredictionTask,
        elder_inputs: dict[str, Any],
    ) -> PredictionTask:
        task.elder_inputs = elder_inputs
        task.elder_submitted_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(task)
        return task

    @staticmethod
    async def mark_status(
        db: AsyncSession,
        task: PredictionTask,
        status: str,
        *,
        features_snapshot: Optional[dict[str, Any]] = None,
        prediction_result_id: Optional[int] = None,
        error_message: Optional[str] = None,
    ) -> PredictionTask:
        task.status = status
        if features_snapshot is not None:
            task.features_snapshot = features_snapshot
        if prediction_result_id is not None:
            task.prediction_result_id = prediction_result_id
        if error_message is not None:
            task.error_message = error_message
        if status == STATUS_PREDICTED:
            task.predicted_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(task)
        return task

    @staticmethod
    async def cancel(db: AsyncSession, task: PredictionTask) -> PredictionTask:
        task.status = STATUS_CANCELLED
        await db.flush()
        await db.refresh(task)
        return task

    @staticmethod
    async def enrich_names(
        db: AsyncSession, tasks: list[PredictionTask]
    ) -> dict[str, dict]:
        """Build id→display-name maps for elders and doctors."""
        elder_ids = {t.elder_id for t in tasks}
        doctor_ids = {t.doctor_user_id for t in tasks}
        elder_map: dict[int, str] = {}
        doctor_map: dict[int, str] = {}
        if elder_ids:
            rows = (
                await db.execute(
                    select(Elder.id, Elder.name).where(Elder.id.in_(elder_ids))
                )
            ).all()
            elder_map = {r[0]: r[1] for r in rows}
        if doctor_ids:
            rows = (
                await db.execute(
                    select(User.id, User.real_name, User.username).where(
                        User.id.in_(doctor_ids)
                    )
                )
            ).all()
            doctor_map = {r[0]: (r[1] or r[2]) for r in rows}
        return {"elder": elder_map, "doctor": doctor_map}
