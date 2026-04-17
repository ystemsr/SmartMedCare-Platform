"""Business logic for elder management."""

import logging
import secrets
import string

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.repositories.elder import ElderRepository
from app.schemas.elder import ElderCreate, ElderResponse, ElderUpdate
from app.utils.pagination import PaginationParams

logger = logging.getLogger(__name__)


class ElderService:
    """Elder management business operations."""

    @staticmethod
    async def create_elder(db: AsyncSession, data: ElderCreate) -> ElderResponse:
        """Create a new elder profile with tags."""
        elder = await ElderRepository.create(db, data, tags=data.tags)
        await db.commit()
        await db.refresh(elder)
        logger.info("Elder created: id=%s name=%s", elder.id, elder.name)
        return ElderResponse.model_validate(elder)

    @staticmethod
    async def get_elder(db: AsyncSession, elder_id: int) -> ElderResponse | None:
        """Get elder details by ID, with latest prediction attached."""
        elder = await ElderRepository.get_by_id(db, elder_id)
        if elder is None:
            return None
        response = ElderResponse.model_validate(elder)

        from app.repositories.bigdata import PredictionResultRepository

        latest = await PredictionResultRepository.get_latest_for_elder(db, elder_id)
        if latest is not None:
            response.latest_risk_score = float(latest.health_score)
            response.latest_high_risk = bool(latest.high_risk)
            response.latest_prediction_at = latest.predicted_at
        return response

    @staticmethod
    async def list_elders(
        db: AsyncSession,
        pagination: PaginationParams,
        gender: str | None = None,
        tag: str | None = None,
        account_status: str | None = None,
        risk_level: str | None = None,
    ):
        """List elders with pagination and filters."""
        result = await ElderRepository.get_list(
            db, pagination, gender=gender, tag=tag,
            account_status=account_status, risk_level=risk_level,
        )

        # Enrich with username and family_count
        if result.items:
            elder_ids = [item.id for item in result.items]

            # Batch fetch family counts
            from app.repositories.family_member import FamilyMemberRepository
            family_counts = await FamilyMemberRepository.count_by_elder_ids(db, elder_ids)

            # Batch fetch usernames via Elder -> user_id -> User
            from sqlalchemy import select as sa_select
            from app.models.elder import Elder
            from app.models.user import User

            stmt = sa_select(Elder.id, User.username).outerjoin(
                User, Elder.user_id == User.id
            ).where(Elder.id.in_(elder_ids))
            rows = await db.execute(stmt)
            username_map = {r[0]: r[1] for r in rows.all()}

            # Batch fetch latest predictions per elder (no N+1)
            from app.repositories.bigdata import PredictionResultRepository

            latest_preds = await PredictionResultRepository.get_latest_for_elders(
                db, elder_ids
            )

            for item in result.items:
                item.username = username_map.get(item.id)
                item.family_count = family_counts.get(item.id, 0)
                pred = latest_preds.get(item.id)
                if pred is not None:
                    item.latest_risk_score = float(pred.health_score)
                    item.latest_high_risk = bool(pred.high_risk)
                    item.latest_prediction_at = pred.predicted_at

        return result

    @staticmethod
    async def update_elder(
        db: AsyncSession, elder_id: int, data: ElderUpdate
    ) -> ElderResponse | None:
        """Update elder info and optionally sync tags."""
        elder = await ElderRepository.update(db, elder_id, data, tags=data.tags)
        if elder is None:
            return None
        await db.commit()
        await db.refresh(elder)
        logger.info("Elder updated: id=%s", elder_id)
        return ElderResponse.model_validate(elder)

    @staticmethod
    async def delete_elder(db: AsyncSession, elder_id: int) -> bool:
        """Soft delete an elder."""
        result = await ElderRepository.delete(db, elder_id)
        if result:
            await db.commit()
            logger.info("Elder deleted: id=%s", elder_id)
        return result

    @staticmethod
    async def reset_password(db: AsyncSession, elder_id: int) -> str | None:
        """Reset elder account password. Returns the plain-text password."""
        # Generate a random 12-char password
        alphabet = string.ascii_letters + string.digits
        plain_password = "".join(secrets.choice(alphabet) for _ in range(12))
        hashed = hash_password(plain_password)

        success = await ElderRepository.reset_password(db, elder_id, hashed)
        if not success:
            return None
        await db.commit()
        logger.info("Elder password reset: id=%s", elder_id)
        return plain_password

    @staticmethod
    async def update_account_status(
        db: AsyncSession, elder_id: int, status: str
    ) -> bool:
        """Enable or disable an elder account."""
        result = await ElderRepository.update_account_status(db, elder_id, status)
        if result:
            await db.commit()
            logger.info("Elder account status updated: id=%s status=%s", elder_id, status)
        return result

    @staticmethod
    async def get_tags(db: AsyncSession) -> list[str]:
        """Get all distinct elder tags."""
        return await ElderRepository.get_all_tags(db)

    @staticmethod
    async def activate_account(db: AsyncSession, elder_id: int) -> dict | str:
        """Create a user account for an elder and link it.

        Returns dict with username and password on success, or error string.
        """
        elder = await ElderRepository.get_by_id(db, elder_id)
        if elder is None:
            return "老人档案不存在"
        if elder.user_id is not None:
            return "该老人已有关联账户"

        # Generate username from phone or elder_<id>
        username = f"elder_{elder.id}" if not elder.phone else elder.phone

        # Check username uniqueness
        from app.repositories.user import UserRepository
        existing = await UserRepository.get_by_username(db, username)
        if existing:
            username = f"elder_{elder.id}"
            existing = await UserRepository.get_by_username(db, username)
            if existing:
                return "用户名已存在，请联系管理员"

        # Generate random password
        alphabet = string.ascii_letters + string.digits
        plain_password = "".join(secrets.choice(alphabet) for _ in range(12))
        hashed = hash_password(plain_password)

        # Create user
        from app.models.user import User, UserRole
        user = User(
            username=username,
            real_name=elder.name,
            phone=elder.phone,
            password_hash=hashed,
            status="active",
        )
        db.add(user)
        await db.flush()

        # Assign elder role (role_id=3)
        user_role = UserRole(user_id=user.id, role_id=3)
        db.add(user_role)

        # Link elder to user
        elder.user_id = user.id
        elder.account_status = "active"

        await db.commit()
        logger.info("Elder account activated: elder_id=%s user_id=%s", elder_id, user.id)
        return {"username": username, "password": plain_password}
