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
        """Get elder details by ID."""
        elder = await ElderRepository.get_by_id(db, elder_id)
        if elder is None:
            return None
        return ElderResponse.model_validate(elder)

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
        return await ElderRepository.get_list(
            db, pagination, gender=gender, tag=tag,
            account_status=account_status, risk_level=risk_level,
        )

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
