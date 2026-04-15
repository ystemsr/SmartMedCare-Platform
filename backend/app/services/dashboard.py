"""Service layer for dashboard business logic."""

import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func, select, text, case, literal_column
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert
from app.models.analytics import ElderRiskProfile
from app.models.followup import Followup
from app.schemas.dashboard import DashboardOverview, TodoItem, TrendData

logger = logging.getLogger(__name__)


class DashboardService:
    """Business logic for dashboard statistics."""

    @staticmethod
    async def get_overview(db: AsyncSession) -> DashboardOverview:
        """Get dashboard overview statistics."""
        # Import models that may be from other branches
        from app.models.elder import Elder
        from app.models.assessment import Assessment

        # Total elders
        elder_stmt = select(func.count(Elder.id)).where(Elder.deleted_at.is_(None))
        elder_result = await db.execute(elder_stmt)
        elder_total = elder_result.scalar_one()

        # High-risk elders
        risk_stmt = select(func.count(ElderRiskProfile.id)).where(
            ElderRiskProfile.risk_level.in_(["high", "critical"]),
            ElderRiskProfile.deleted_at.is_(None),
        )
        risk_result = await db.execute(risk_stmt)
        high_risk_total = risk_result.scalar_one()

        # Pending alerts
        alert_stmt = select(func.count(Alert.id)).where(
            Alert.status == "pending", Alert.deleted_at.is_(None)
        )
        alert_result = await db.execute(alert_stmt)
        pending_alert_total = alert_result.scalar_one()

        # Todo followups
        followup_todo_stmt = select(func.count(Followup.id)).where(
            Followup.status == "todo", Followup.deleted_at.is_(None)
        )
        followup_todo_result = await db.execute(followup_todo_stmt)
        todo_followup_total = followup_todo_result.scalar_one()

        # Completed followups today
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        followup_done_stmt = select(func.count(Followup.id)).where(
            Followup.status == "completed",
            Followup.updated_at >= today_start,
            Followup.deleted_at.is_(None),
        )
        followup_done_result = await db.execute(followup_done_stmt)
        completed_followup_today = followup_done_result.scalar_one()

        # Assessments created today
        assessment_stmt = select(func.count(Assessment.id)).where(
            Assessment.created_at >= today_start,
            Assessment.deleted_at.is_(None),
        )
        assessment_result = await db.execute(assessment_stmt)
        assessment_total_today = assessment_result.scalar_one()

        return DashboardOverview(
            elder_total=elder_total,
            high_risk_total=high_risk_total,
            pending_alert_total=pending_alert_total,
            todo_followup_total=todo_followup_total,
            completed_followup_today=completed_followup_today,
            assessment_total_today=assessment_total_today,
        )

    @staticmethod
    async def get_todos(db: AsyncSession, limit: int = 10) -> list[TodoItem]:
        """Get recent todo items (pending alerts + todo followups)."""
        from app.models.elder import Elder

        todos: list[TodoItem] = []

        # Pending alerts with elder name
        alert_stmt = (
            select(Alert.id, Alert.title, Alert.risk_level, Alert.created_at, Elder.name)
            .join(Elder, Alert.elder_id == Elder.id, isouter=True)
            .where(Alert.status == "pending", Alert.deleted_at.is_(None))
            .order_by(Alert.created_at.desc())
            .limit(limit)
        )
        alert_result = await db.execute(alert_stmt)
        for row in alert_result.all():
            todos.append(
                TodoItem(
                    id=row[0],
                    type="alert",
                    title=row[1],
                    elder_name=row[4],
                    risk_level=row[2],
                    created_at=row[3],
                )
            )

        # Todo followups with elder name
        followup_stmt = (
            select(
                Followup.id, Followup.plan_type, Followup.planned_at,
                Followup.created_at, Elder.name,
            )
            .join(Elder, Followup.elder_id == Elder.id, isouter=True)
            .where(Followup.status == "todo", Followup.deleted_at.is_(None))
            .order_by(Followup.created_at.desc())
            .limit(limit)
        )
        followup_result = await db.execute(followup_stmt)
        for row in followup_result.all():
            todos.append(
                TodoItem(
                    id=row[0],
                    type="followup",
                    title=f"随访计划: {row[1]}",
                    elder_name=row[4],
                    planned_at=row[2],
                    created_at=row[3],
                )
            )

        # Sort combined by created_at desc, limit
        todos.sort(key=lambda t: t.created_at or datetime.min, reverse=True)
        return todos[:limit]

    @staticmethod
    async def get_trends(
        db: AsyncSession, range_: str = "7d"
    ) -> list[TrendData]:
        """Get daily trend data for alerts, followups, and assessments."""
        from app.models.assessment import Assessment

        # Parse range
        days = {"7d": 7, "30d": 30, "90d": 90}.get(range_, 7)
        start_date = datetime.utcnow() - timedelta(days=days)

        # Build date series and aggregate
        trends: dict[str, TrendData] = {}

        # Initialize all dates
        for i in range(days):
            d = (start_date + timedelta(days=i + 1)).strftime("%Y-%m-%d")
            trends[d] = TrendData(date=d)

        # Alerts per day
        alert_stmt = (
            select(
                func.date(Alert.created_at).label("d"),
                func.count(Alert.id).label("cnt"),
            )
            .where(Alert.created_at >= start_date, Alert.deleted_at.is_(None))
            .group_by(text("d"))
        )
        alert_result = await db.execute(alert_stmt)
        for row in alert_result.all():
            date_str = str(row[0])
            if date_str in trends:
                trends[date_str].alerts = row[1]

        # Followups per day
        followup_stmt = (
            select(
                func.date(Followup.created_at).label("d"),
                func.count(Followup.id).label("cnt"),
            )
            .where(Followup.created_at >= start_date, Followup.deleted_at.is_(None))
            .group_by(text("d"))
        )
        followup_result = await db.execute(followup_stmt)
        for row in followup_result.all():
            date_str = str(row[0])
            if date_str in trends:
                trends[date_str].followups = row[1]

        # Assessments per day
        assessment_stmt = (
            select(
                func.date(Assessment.created_at).label("d"),
                func.count(Assessment.id).label("cnt"),
            )
            .where(Assessment.created_at >= start_date, Assessment.deleted_at.is_(None))
            .group_by(text("d"))
        )
        assessment_result = await db.execute(assessment_stmt)
        for row in assessment_result.all():
            date_str = str(row[0])
            if date_str in trends:
                trends[date_str].assessments = row[1]

        return sorted(trends.values(), key=lambda t: t.date)
