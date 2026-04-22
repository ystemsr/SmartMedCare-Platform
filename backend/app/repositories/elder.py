"""Repository layer for elder data access."""

import logging
from typing import Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.elder import Elder, ElderTag
from app.schemas.elder import ElderCreate, ElderResponse, ElderUpdate
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)


class ElderRepository:
    """Data access operations for elders."""

    @staticmethod
    async def get_by_id(db: AsyncSession, elder_id: int) -> Optional[Elder]:
        """Get an elder by ID with tags loaded."""
        stmt = (
            select(Elder)
            .options(selectinload(Elder.tags))
            .where(Elder.id == elder_id, Elder.deleted_at.is_(None))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_user_id(db: AsyncSession, user_id: int) -> Optional[Elder]:
        """Get an elder by their linked user account ID."""
        stmt = (
            select(Elder)
            .options(selectinload(Elder.tags))
            .where(Elder.user_id == user_id, Elder.deleted_at.is_(None))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_list(
        db: AsyncSession,
        pagination: PaginationParams,
        gender: Optional[str] = None,
        tag: Optional[str] = None,
        account_status: Optional[str] = None,
        risk_level: Optional[str] = None,
        primary_doctor_id: Optional[int] = None,
    ):
        """Get paginated list of elders with optional filters."""
        stmt = (
            select(Elder)
            .options(selectinload(Elder.tags), selectinload(Elder.user))
            .where(Elder.deleted_at.is_(None))
        )

        # Keyword search on name, phone, id_card
        if pagination.keyword:
            kw = f"%{pagination.keyword}%"
            stmt = stmt.where(
                (Elder.name.ilike(kw))
                | (Elder.phone.ilike(kw))
                | (Elder.id_card.ilike(kw))
            )

        if gender:
            stmt = stmt.where(Elder.gender == gender)

        if account_status:
            stmt = stmt.where(Elder.account_status == account_status)

        if primary_doctor_id is not None:
            stmt = stmt.where(Elder.primary_doctor_id == primary_doctor_id)

        if tag:
            stmt = stmt.where(
                Elder.id.in_(
                    select(ElderTag.elder_id).where(
                        ElderTag.tag_name == tag,
                        ElderTag.deleted_at.is_(None),
                    )
                )
            )

        if risk_level:
            # Match the four buckets the frontend list renders (未评估/高风险/
            # 关注/正常). Uses a latest-per-elder join against prediction_results.
            from app.models.bigdata import PredictionResult

            latest_subq = (
                select(
                    PredictionResult.elder_id.label("eid"),
                    func.max(PredictionResult.predicted_at).label("max_at"),
                )
                .where(PredictionResult.deleted_at.is_(None))
                .group_by(PredictionResult.elder_id)
                .subquery()
            )

            if risk_level == "unassessed":
                stmt = stmt.where(
                    Elder.id.notin_(select(latest_subq.c.eid))
                )
            else:
                latest_join = (
                    select(PredictionResult.elder_id)
                    .join(
                        latest_subq,
                        and_(
                            PredictionResult.elder_id == latest_subq.c.eid,
                            PredictionResult.predicted_at == latest_subq.c.max_at,
                        ),
                    )
                    .where(PredictionResult.deleted_at.is_(None))
                )
                if risk_level == "high":
                    matched = latest_join.where(PredictionResult.high_risk.is_(True))
                elif risk_level == "normal":
                    matched = latest_join.where(
                        PredictionResult.high_risk.is_(False),
                        PredictionResult.health_score >= 70,
                    )
                elif risk_level == "watch":
                    matched = latest_join.where(
                        PredictionResult.high_risk.is_(False),
                        PredictionResult.health_score < 70,
                    )
                else:
                    matched = None
                if matched is not None:
                    stmt = stmt.where(Elder.id.in_(matched))

        return await paginate(stmt, db, pagination, ElderResponse)

    @staticmethod
    async def create(
        db: AsyncSession,
        data: ElderCreate,
        tags: Optional[list[str]] = None,
    ) -> Elder:
        """Create a new elder with optional tags."""
        elder = Elder(
            name=data.name,
            gender=data.gender,
            birth_date=data.birth_date,
            id_card=data.id_card,
            phone=data.phone,
            address=data.address,
            emergency_contact_name=data.emergency_contact_name,
            emergency_contact_phone=data.emergency_contact_phone,
            primary_doctor_id=data.primary_doctor_id,
        )
        if tags:
            elder.tags = [ElderTag(tag_name=t) for t in tags]

        db.add(elder)
        await db.flush()
        await db.refresh(elder)
        return elder

    @staticmethod
    async def update(
        db: AsyncSession,
        elder_id: int,
        data: ElderUpdate,
        tags: Optional[list[str]] = None,
    ) -> Optional[Elder]:
        """Update an elder and optionally sync tags."""
        elder = await ElderRepository.get_by_id(db, elder_id)
        if elder is None:
            return None

        update_data = data.model_dump(exclude_unset=True, exclude={"tags"})
        for field, value in update_data.items():
            setattr(elder, field, value)

        if tags is not None:
            # Remove existing tags and replace
            elder.tags.clear()
            elder.tags = [ElderTag(tag_name=t) for t in tags]

        await db.flush()
        await db.refresh(elder)
        return elder

    @staticmethod
    async def delete(db: AsyncSession, elder_id: int) -> bool:
        """Soft delete an elder."""
        elder = await ElderRepository.get_by_id(db, elder_id)
        if elder is None:
            return False

        from datetime import datetime, timezone

        elder.deleted_at = datetime.now(timezone.utc)
        await db.flush()
        return True

    @staticmethod
    async def reset_password(
        db: AsyncSession, elder_id: int, new_hash: str
    ) -> bool:
        """Reset the account password hash for an elder."""
        elder = await ElderRepository.get_by_id(db, elder_id)
        if elder is None:
            return False
        elder.account_password_hash = new_hash
        await db.flush()
        return True

    @staticmethod
    async def update_account_status(
        db: AsyncSession, elder_id: int, status: str
    ) -> bool:
        """Enable or disable an elder account."""
        elder = await ElderRepository.get_by_id(db, elder_id)
        if elder is None:
            return False
        elder.account_status = status
        await db.flush()
        return True

    @staticmethod
    async def get_all_tags(db: AsyncSession) -> list[str]:
        """Get all distinct tag names."""
        stmt = (
            select(ElderTag.tag_name)
            .where(ElderTag.deleted_at.is_(None))
            .distinct()
            .order_by(ElderTag.tag_name)
        )
        result = await db.execute(stmt)
        return [row[0] for row in result.all()]
