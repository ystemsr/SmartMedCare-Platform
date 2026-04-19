"""Business logic for invite code management."""

import logging
import secrets
import string
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.invite_code import InviteCodeRepository
from app.schemas.invite_code import InviteCodeResponse, InviteCodeValidateResponse

logger = logging.getLogger(__name__)

CODE_LENGTH = 8
MAX_FAMILY_MEMBERS = 3
# Invite codes are permanent per elder; store a sentinel far-future expiry so
# legacy expires_at checks elsewhere always pass.
_PERMANENT_EXPIRES_AT = datetime(2099, 12, 31, 23, 59, 59)


def _generate_code() -> str:
    """Generate an 8-character alphanumeric invite code."""
    alphabet = string.ascii_uppercase + string.digits
    # Remove ambiguous characters
    alphabet = alphabet.replace("O", "").replace("0", "").replace("I", "").replace("1", "")
    return "".join(secrets.choice(alphabet) for _ in range(CODE_LENGTH))


class InviteCodeService:
    """Invite code business operations."""

    @staticmethod
    async def generate_code(db: AsyncSession, elder_id: int) -> InviteCodeResponse:
        """Return the elder's permanent invite code, creating it on first call."""
        existing = await InviteCodeRepository.get_active_by_elder_id(db, elder_id)
        if existing:
            return InviteCodeResponse(
                code=existing.code,
                expires_at=existing.expires_at,
                used_count=existing.used_count,
                max_uses=existing.max_uses,
                remaining_slots=existing.max_uses - existing.used_count,
            )

        code = _generate_code()
        invite = await InviteCodeRepository.create(
            db, elder_id=elder_id, code=code, expires_at=_PERMANENT_EXPIRES_AT
        )
        await db.commit()
        await db.refresh(invite)
        logger.info("Permanent invite code created: elder_id=%s code=%s", elder_id, code)
        return InviteCodeResponse(
            code=invite.code,
            expires_at=invite.expires_at,
            used_count=invite.used_count,
            max_uses=invite.max_uses,
            remaining_slots=invite.max_uses - invite.used_count,
        )

    @staticmethod
    async def get_active_code(db: AsyncSession, elder_id: int) -> InviteCodeResponse | None:
        """Get the elder's permanent invite code, creating it lazily if missing."""
        existing = await InviteCodeRepository.get_active_by_elder_id(db, elder_id)
        if existing is None:
            return await InviteCodeService.generate_code(db, elder_id)
        return InviteCodeResponse(
            code=existing.code,
            expires_at=existing.expires_at,
            used_count=existing.used_count,
            max_uses=existing.max_uses,
            remaining_slots=existing.max_uses - existing.used_count,
        )

    @staticmethod
    async def validate_code(db: AsyncSession, code: str) -> InviteCodeValidateResponse:
        """Validate an invite code (public endpoint)."""
        invite = await InviteCodeRepository.get_by_code(db, code)
        if not invite:
            return InviteCodeValidateResponse(valid=False)

        now = datetime.now(timezone.utc)
        if invite.expires_at.replace(tzinfo=timezone.utc) <= now:
            return InviteCodeValidateResponse(valid=False)
        if invite.used_count >= invite.max_uses:
            return InviteCodeValidateResponse(valid=False)

        # Load elder name for display (masked)
        from app.repositories.elder import ElderRepository
        elder = await ElderRepository.get_by_id(db, invite.elder_id)
        if not elder:
            return InviteCodeValidateResponse(valid=False)

        # Mask elder name: keep first char, mask the rest
        name = elder.name
        masked_name = name[0] + "*" * (len(name) - 1) if len(name) > 1 else name

        return InviteCodeValidateResponse(
            valid=True,
            elder_name=masked_name,
            remaining_slots=invite.max_uses - invite.used_count,
        )

    @staticmethod
    async def revoke_code(db: AsyncSession, elder_id: int) -> bool:
        """Revoke all active invite codes for an elder."""
        result = await InviteCodeRepository.soft_delete_by_elder_id(db, elder_id)
        if result:
            await db.commit()
            logger.info("Invite codes revoked: elder_id=%s", elder_id)
        return result
