"""Business logic for health assessments."""

import logging
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.assessment import AssessmentRepository
from app.repositories.health_archive import HealthRecordRepository
from app.schemas.assessment import (
    AssessmentCreate,
    AssessmentResponse,
    AssessmentUpdate,
)
from app.utils.pagination import PaginationParams

logger = logging.getLogger(__name__)


async def _enrich_one(
    db: AsyncSession, response: AssessmentResponse
) -> AssessmentResponse:
    """Attach elder_name / created_by_name to a single assessment response."""
    from app.models.elder import Elder
    from app.models.user import User

    if response.elder_id is not None:
        row = await db.execute(select(Elder.name).where(Elder.id == response.elder_id))
        response.elder_name = row.scalar_one_or_none()
    if response.created_by is not None:
        row = await db.execute(
            select(User.real_name, User.username).where(User.id == response.created_by)
        )
        item = row.first()
        if item is not None:
            response.created_by_name = item[0] or item[1]
    return response


async def _enrich_list(db: AsyncSession, page):
    """Attach elder_name / created_by_name to a paginated list of assessments."""
    from app.models.elder import Elder
    from app.models.user import User

    elder_ids = {item.elder_id for item in page.items if item.elder_id is not None}
    if elder_ids:
        rows = await db.execute(
            select(Elder.id, Elder.name).where(Elder.id.in_(elder_ids))
        )
        elder_map = {r[0]: r[1] for r in rows.all()}
        for item in page.items:
            if item.elder_id is not None:
                item.elder_name = elder_map.get(item.elder_id)

    creator_ids = {
        item.created_by for item in page.items if item.created_by is not None
    }
    if creator_ids:
        rows = await db.execute(
            select(User.id, User.real_name, User.username).where(
                User.id.in_(creator_ids)
            )
        )
        creator_map = {r[0]: (r[1] or r[2]) for r in rows.all()}
        for item in page.items:
            if item.created_by is not None:
                item.created_by_name = creator_map.get(item.created_by)
    return page


class AssessmentService:
    """Assessment business operations."""

    @staticmethod
    async def create_assessment(
        db: AsyncSession, data: AssessmentCreate, created_by: Optional[int] = None
    ) -> AssessmentResponse:
        """Create a new assessment."""
        assessment = await AssessmentRepository.create(db, data, created_by=created_by)
        await db.commit()
        await db.refresh(assessment)
        logger.info("Assessment created: id=%s elder_id=%s", assessment.id, data.elder_id)
        response = AssessmentResponse.model_validate(assessment)
        return await _enrich_one(db, response)

    @staticmethod
    async def list_assessments(
        db: AsyncSession,
        pagination: PaginationParams,
        elder_id: Optional[int] = None,
        risk_level: Optional[str] = None,
        assessment_type: Optional[str] = None,
        date_start: Optional[str] = None,
        date_end: Optional[str] = None,
    ):
        """List assessments with filters and pagination (enriched with names)."""
        page = await AssessmentRepository.get_list(
            db, pagination,
            elder_id=elder_id,
            risk_level=risk_level,
            assessment_type=assessment_type,
            date_start=date_start,
            date_end=date_end,
        )
        return await _enrich_list(db, page)

    @staticmethod
    async def get_assessment(
        db: AsyncSession, assessment_id: int
    ) -> AssessmentResponse | None:
        """Get a single assessment."""
        assessment = await AssessmentRepository.get_by_id(db, assessment_id)
        if assessment is None:
            return None
        response = AssessmentResponse.model_validate(assessment)
        return await _enrich_one(db, response)

    @staticmethod
    async def update_assessment(
        db: AsyncSession, assessment_id: int, data: AssessmentUpdate
    ) -> AssessmentResponse | None:
        """Update an assessment."""
        assessment = await AssessmentRepository.update(db, assessment_id, data)
        if assessment is None:
            return None
        await db.commit()
        await db.refresh(assessment)
        logger.info("Assessment updated: id=%s", assessment_id)
        response = AssessmentResponse.model_validate(assessment)
        return await _enrich_one(db, response)

    @staticmethod
    async def delete_assessment(db: AsyncSession, assessment_id: int) -> bool:
        """Soft delete an assessment."""
        result = await AssessmentRepository.delete(db, assessment_id)
        if result:
            await db.commit()
            logger.info("Assessment deleted: id=%s", assessment_id)
        return result

    @staticmethod
    async def generate_assessment(
        db: AsyncSession,
        elder_id: int,
        force: bool = False,
        created_by: Optional[int] = None,
    ) -> AssessmentResponse | None:
        """Auto-generate an assessment from the latest health data.

        If force is False and a recent assessment exists, return it.
        Otherwise calculate a new risk score.
        """
        if not force:
            existing = await AssessmentRepository.get_latest_by_elder(db, elder_id)
            if existing is not None:
                response = AssessmentResponse.model_validate(existing)
                return await _enrich_one(db, response)

        # Fetch the latest health record
        health_record = await HealthRecordRepository.get_latest_by_elder(db, elder_id)
        if health_record is None:
            logger.info("No health records found for elder_id=%s, cannot generate assessment", elder_id)
            return None

        # Calculate risk score
        total_risk_points = 0
        suggestions: list[str] = []

        if health_record.blood_pressure_systolic and health_record.blood_pressure_systolic > 140:
            total_risk_points += 20
            suggestions.append("收缩压偏高，建议一周内复测血压")

        if health_record.blood_pressure_diastolic and health_record.blood_pressure_diastolic > 90:
            total_risk_points += 15
            suggestions.append("舒张压偏高，建议关注血压变化")

        if health_record.blood_glucose and health_record.blood_glucose > Decimal("7.0"):
            total_risk_points += 15
            suggestions.append("血糖偏高，建议进行糖化血红蛋白检测")

        if health_record.heart_rate:
            if health_record.heart_rate > 100:
                total_risk_points += 10
                suggestions.append("心率过快，建议进一步检查")
            elif health_record.heart_rate < 50:
                total_risk_points += 10
                suggestions.append("心率过缓，建议进一步检查")

        if health_record.temperature and health_record.temperature > Decimal("37.5"):
            total_risk_points += 10
            suggestions.append("体温偏高，建议观察是否有感染症状")

        if health_record.chronic_diseases and isinstance(health_record.chronic_diseases, list):
            disease_count = len(health_record.chronic_diseases)
            total_risk_points += 5 * disease_count
            if disease_count > 0:
                suggestions.append(f"存在{disease_count}种慢性疾病，建议加强管理")

        # Calculate score (0-100, higher is better)
        score = max(0, min(100, 100 - total_risk_points))

        # Map score to risk level
        if score >= 80:
            risk_level = "low"
        elif score >= 60:
            risk_level = "medium"
        elif score >= 40:
            risk_level = "high"
        else:
            risk_level = "critical"

        if not suggestions:
            suggestions.append("各项指标正常，建议继续保持")

        # Build summary
        summary = f"健康评分 {score} 分，风险等级：{risk_level}"

        # Create the assessment
        assessment_data = AssessmentCreate(
            elder_id=elder_id,
            assessment_type="comprehensive",
            score=score,
            risk_level=risk_level,
            summary=summary,
            suggestions=suggestions,
        )
        assessment = await AssessmentRepository.create(db, assessment_data, created_by=created_by)
        await db.commit()
        await db.refresh(assessment)
        logger.info(
            "Assessment generated: id=%s elder_id=%s score=%s risk=%s",
            assessment.id, elder_id, score, risk_level,
        )
        response = AssessmentResponse.model_validate(assessment)
        return await _enrich_one(db, response)
