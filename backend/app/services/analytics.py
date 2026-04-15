"""Service layer for analytics business logic."""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert
from app.models.analytics import AnalyticsJob, ElderRiskProfile
from app.models.followup import Followup
from app.models.intervention import Intervention
from app.schemas.analytics import (
    AgeDistribution,
    AlertTrend,
    AnalyticsJobResponse,
    AnalyticsOverview,
    ChronicDiseaseDistribution,
    FollowupCompletion,
    InterventionEffectiveness,
    RiskDistribution,
    RiskFactor,
    RiskProfile,
)

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Business logic for analytics."""

    @staticmethod
    async def get_overview(db: AsyncSession) -> AnalyticsOverview:
        """Get platform-level analytics overview."""
        from app.models.elder import Elder

        # Total elders
        elder_stmt = select(func.count(Elder.id)).where(Elder.deleted_at.is_(None))
        elder_total = (await db.execute(elder_stmt)).scalar_one()

        # Gender counts
        male_stmt = select(func.count(Elder.id)).where(
            Elder.gender == "male", Elder.deleted_at.is_(None)
        )
        male_total = (await db.execute(male_stmt)).scalar_one()

        female_stmt = select(func.count(Elder.id)).where(
            Elder.gender == "female", Elder.deleted_at.is_(None)
        )
        female_total = (await db.execute(female_stmt)).scalar_one()

        # Risk counts
        high_risk_stmt = select(func.count(ElderRiskProfile.id)).where(
            ElderRiskProfile.risk_level.in_(["high", "critical"]),
            ElderRiskProfile.deleted_at.is_(None),
        )
        high_risk_total = (await db.execute(high_risk_stmt)).scalar_one()

        medium_risk_stmt = select(func.count(ElderRiskProfile.id)).where(
            ElderRiskProfile.risk_level == "medium",
            ElderRiskProfile.deleted_at.is_(None),
        )
        medium_risk_total = (await db.execute(medium_risk_stmt)).scalar_one()

        # Pending alerts
        alert_stmt = select(func.count(Alert.id)).where(
            Alert.status == "pending", Alert.deleted_at.is_(None)
        )
        pending_alert_total = (await db.execute(alert_stmt)).scalar_one()

        # Followup completion rate
        total_followups_stmt = select(func.count(Followup.id)).where(
            Followup.deleted_at.is_(None)
        )
        total_followups = (await db.execute(total_followups_stmt)).scalar_one()

        completed_followups_stmt = select(func.count(Followup.id)).where(
            Followup.status == "completed", Followup.deleted_at.is_(None)
        )
        completed_followups = (await db.execute(completed_followups_stmt)).scalar_one()

        rate = round(completed_followups / total_followups, 2) if total_followups > 0 else 0.0

        return AnalyticsOverview(
            elder_total=elder_total,
            male_total=male_total,
            female_total=female_total,
            high_risk_total=high_risk_total,
            medium_risk_total=medium_risk_total,
            pending_alert_total=pending_alert_total,
            followup_completion_rate=rate,
        )

    @staticmethod
    async def get_age_distribution(db: AsyncSession) -> list[AgeDistribution]:
        """Get age distribution of elders (60-69, 70-79, 80-89, 90+)."""
        from app.models.elder import Elder

        now = datetime.now(timezone.utc)
        ranges = [
            ("60-69", 60, 69),
            ("70-79", 70, 79),
            ("80-89", 80, 89),
            ("90+", 90, 200),
        ]
        result: list[AgeDistribution] = []

        for label, min_age, max_age in ranges:
            # birth_date between (now - max_age - 1 years) and (now - min_age years)
            max_birth = now.replace(year=now.year - min_age)
            min_birth = now.replace(year=now.year - max_age - 1)
            stmt = select(func.count(Elder.id)).where(
                Elder.birth_date.isnot(None),
                Elder.birth_date <= max_birth,
                Elder.birth_date > min_birth,
                Elder.deleted_at.is_(None),
            )
            count = (await db.execute(stmt)).scalar_one()
            result.append(AgeDistribution(age_range=label, count=count))

        return result

    @staticmethod
    async def get_chronic_disease_distribution(
        db: AsyncSession,
    ) -> list[ChronicDiseaseDistribution]:
        """Get chronic disease distribution from health records."""
        from app.models.health_archive import HealthRecord

        # Fetch all non-null chronic_diseases JSON arrays
        stmt = select(HealthRecord.chronic_diseases).where(
            HealthRecord.chronic_diseases.isnot(None),
            HealthRecord.deleted_at.is_(None),
        )
        rows = (await db.execute(stmt)).scalars().all()

        disease_counts: dict[str, int] = {}
        for diseases in rows:
            if isinstance(diseases, list):
                for disease in diseases:
                    if isinstance(disease, str) and disease:
                        disease_counts[disease] = disease_counts.get(disease, 0) + 1

        return [
            ChronicDiseaseDistribution(disease=d, count=c)
            for d, c in sorted(disease_counts.items(), key=lambda x: -x[1])
        ]

    @staticmethod
    async def get_risk_distribution(db: AsyncSession) -> list[RiskDistribution]:
        """Get risk level distribution."""
        stmt = (
            select(
                ElderRiskProfile.risk_level,
                func.count(ElderRiskProfile.id),
            )
            .where(ElderRiskProfile.deleted_at.is_(None))
            .group_by(ElderRiskProfile.risk_level)
        )
        rows = (await db.execute(stmt)).all()
        return [RiskDistribution(risk_level=row[0], count=row[1]) for row in rows]

    @staticmethod
    async def get_alert_trend(
        db: AsyncSession,
        range_: str = "7d",
        granularity: str = "day",
    ) -> list[AlertTrend]:
        """Get alert trend data."""
        days = {"7d": 7, "30d": 30, "90d": 90}.get(range_, 7)
        start_date = datetime.now(timezone.utc) - timedelta(days=days)

        if granularity == "month":
            date_expr = func.date_format(Alert.created_at, "%Y-%m")
        elif granularity == "week":
            date_expr = func.date_format(Alert.created_at, "%Y-%u")
        else:
            date_expr = func.date(Alert.created_at)

        stmt = (
            select(
                date_expr.label("d"),
                func.count(Alert.id).label("cnt"),
            )
            .where(Alert.created_at >= start_date, Alert.deleted_at.is_(None))
            .group_by(text("d"))
            .order_by(text("d"))
        )
        rows = (await db.execute(stmt)).all()
        return [AlertTrend(date=str(row[0]), count=row[1]) for row in rows]

    @staticmethod
    async def get_followup_completion(db: AsyncSession) -> list[FollowupCompletion]:
        """Get followup completion rates by month."""
        stmt = (
            select(
                func.date_format(Followup.created_at, "%Y-%m").label("period"),
                func.count(Followup.id).label("total"),
                func.sum(
                    func.if_(Followup.status == "completed", 1, 0)
                ).label("completed"),
            )
            .where(Followup.deleted_at.is_(None))
            .group_by(text("period"))
            .order_by(text("period"))
        )
        rows = (await db.execute(stmt)).all()
        result: list[FollowupCompletion] = []
        for row in rows:
            total = row[1]
            completed = int(row[2] or 0)
            rate = round(completed / total, 2) if total > 0 else 0.0
            result.append(
                FollowupCompletion(
                    period=str(row[0]),
                    total=total,
                    completed=completed,
                    rate=rate,
                )
            )
        return result

    @staticmethod
    async def get_intervention_effectiveness(
        db: AsyncSession,
    ) -> list[InterventionEffectiveness]:
        """Get intervention effectiveness by type."""
        stmt = (
            select(
                Intervention.type,
                func.count(Intervention.id).label("total"),
                func.sum(
                    func.if_(Intervention.status == "completed", 1, 0)
                ).label("completed"),
            )
            .where(Intervention.deleted_at.is_(None))
            .group_by(Intervention.type)
        )
        rows = (await db.execute(stmt)).all()
        result: list[InterventionEffectiveness] = []
        for row in rows:
            total = row[1]
            completed = int(row[2] or 0)
            rate = round(completed / total, 2) if total > 0 else 0.0
            result.append(
                InterventionEffectiveness(
                    type=row[0],
                    total=total,
                    completed=completed,
                    success_rate=rate,
                )
            )
        return result

    @staticmethod
    async def get_risk_profile(
        db: AsyncSession, elder_id: int
    ) -> Optional[RiskProfile]:
        """Get the risk profile for an elder."""
        stmt = select(ElderRiskProfile).where(
            ElderRiskProfile.elder_id == elder_id,
            ElderRiskProfile.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()
        if profile is None:
            return None

        factors = None
        if profile.factors and isinstance(profile.factors, list):
            factors = [
                RiskFactor(name=f.get("name", ""), weight=f.get("weight", 0.0))
                for f in profile.factors
            ]

        return RiskProfile(
            elder_id=profile.elder_id,
            risk_score=float(profile.risk_score) if profile.risk_score else None,
            risk_level=profile.risk_level,
            factors=factors,
            updated_at=profile.updated_at,
        )

    @staticmethod
    async def run_job(
        db: AsyncSession, job_type: str, date: Optional[str] = None
    ) -> AnalyticsJobResponse:
        """Create and run an analytics job."""
        job_id = f"job_{datetime.now(timezone.utc).strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}"
        job = AnalyticsJob(
            job_type=job_type,
            job_id=job_id,
            status="pending",
        )
        db.add(job)
        await db.flush()
        await db.refresh(job)

        # Run the stub job
        from app.tasks.analytics_jobs import run_analytics_job

        await run_analytics_job(db, job_type, date)
        await db.refresh(job)
        await db.commit()

        return AnalyticsJobResponse.model_validate(job)

    @staticmethod
    async def get_job(
        db: AsyncSession, job_id: str
    ) -> Optional[AnalyticsJobResponse]:
        """Get an analytics job by its job_id."""
        stmt = select(AnalyticsJob).where(
            AnalyticsJob.job_id == job_id,
            AnalyticsJob.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        job = result.scalar_one_or_none()
        if job is None:
            return None
        return AnalyticsJobResponse.model_validate(job)
