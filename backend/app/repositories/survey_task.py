"""Repository for SurveyTask."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.elder import Elder
from app.models.survey_task import SurveyTask
from app.models.user import User


class SurveyTaskRepository:
    """CRUD for survey_tasks."""

    @staticmethod
    async def create(
        db: AsyncSession,
        *,
        elder_id: int,
        doctor_user_id: int,
        requested_fields: list[str],
        title: str = "健康信息采集",
        message: Optional[str] = None,
        due_at: Optional[datetime] = None,
    ) -> SurveyTask:
        task = SurveyTask(
            elder_id=elder_id,
            doctor_user_id=doctor_user_id,
            requested_fields=requested_fields,
            title=title,
            message=message,
            due_at=due_at,
            status="pending",
        )
        db.add(task)
        await db.flush()
        await db.refresh(task)
        return task

    @staticmethod
    async def get_by_id(db: AsyncSession, task_id: int) -> Optional[SurveyTask]:
        stmt = select(SurveyTask).where(
            SurveyTask.id == task_id, SurveyTask.deleted_at.is_(None)
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def list_for_elder(
        db: AsyncSession, elder_id: int, status: Optional[str] = None, limit: int = 100
    ) -> list[SurveyTask]:
        stmt = select(SurveyTask).where(
            SurveyTask.elder_id == elder_id, SurveyTask.deleted_at.is_(None)
        )
        if status:
            stmt = stmt.where(SurveyTask.status == status)
        stmt = stmt.order_by(desc(SurveyTask.created_at)).limit(limit)
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def list_for_doctor(
        db: AsyncSession,
        doctor_user_id: Optional[int] = None,
        elder_id: Optional[int] = None,
        status: Optional[str] = None,
        limit: int = 200,
    ) -> list[SurveyTask]:
        stmt = select(SurveyTask).where(SurveyTask.deleted_at.is_(None))
        if doctor_user_id is not None:
            stmt = stmt.where(SurveyTask.doctor_user_id == doctor_user_id)
        if elder_id is not None:
            stmt = stmt.where(SurveyTask.elder_id == elder_id)
        if status:
            stmt = stmt.where(SurveyTask.status == status)
        stmt = stmt.order_by(desc(SurveyTask.created_at)).limit(limit)
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def submit(
        db: AsyncSession, task: SurveyTask, responses: dict
    ) -> SurveyTask:
        task.responses = responses
        task.status = "submitted"
        task.submitted_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(task)
        return task

    @staticmethod
    async def cancel(db: AsyncSession, task: SurveyTask) -> SurveyTask:
        task.status = "cancelled"
        await db.flush()
        await db.refresh(task)
        return task

    @staticmethod
    async def get_latest_responses_for_elder(
        db: AsyncSession, elder_id: int
    ) -> dict:
        """Merge most recent submitted responses for the elder (per field).

        Later submissions override earlier ones per field key, so the
        latest answer wins.
        """
        stmt = (
            select(SurveyTask)
            .where(
                SurveyTask.elder_id == elder_id,
                SurveyTask.status == "submitted",
                SurveyTask.deleted_at.is_(None),
            )
            .order_by(SurveyTask.submitted_at.asc())
        )
        rows = (await db.execute(stmt)).scalars().all()
        merged: dict = {}
        for row in rows:
            if isinstance(row.responses, dict):
                merged.update(row.responses)
        return merged

    @staticmethod
    async def enrich_names(
        db: AsyncSession, tasks: list[SurveyTask]
    ) -> dict[str, dict]:
        """Build id→display-name maps for elders and doctors across tasks."""
        elder_ids = {t.elder_id for t in tasks}
        doctor_ids = {t.doctor_user_id for t in tasks}
        elder_map: dict[int, str] = {}
        doctor_map: dict[int, str] = {}
        if elder_ids:
            rows = (
                await db.execute(select(Elder.id, Elder.name).where(Elder.id.in_(elder_ids)))
            ).all()
            elder_map = {r[0]: r[1] for r in rows}
        if doctor_ids:
            rows = (
                await db.execute(
                    select(User.id, User.real_name, User.username).where(User.id.in_(doctor_ids))
                )
            ).all()
            doctor_map = {r[0]: (r[1] or r[2]) for r in rows}
        return {"elder": elder_map, "doctor": doctor_map}
