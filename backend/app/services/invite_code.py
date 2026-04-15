"""Business logic for invite code operations."""

import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.elder import ElderRepository
from app.repositories.invite_code import InviteCodeRepository
from app.schemas.family_member import InviteCodeValidationResponse

logger = logging.getLogger(__name__)


class InviteCodeService:
    """Invite code business operations."""

    @staticmethod
    async def validate_code(
        db: AsyncSession, code: str
    ) -> InviteCodeValidationResponse:
        """Validate an invite code and return elder info if valid."""
        invite = await InviteCodeRepository.get_by_code(db, code)
        if invite is None:
            return InviteCodeValidationResponse(
                valid=False, message="邀请码不存在"
            )

        now = datetime.now(timezone.utc)
        if invite.expires_at.replace(tzinfo=timezone.utc) <= now:
            return InviteCodeValidationResponse(
                valid=False, message="邀请码已过期"
            )

        if invite.used_count >= invite.max_uses:
            return InviteCodeValidationResponse(
                valid=False, message="邀请码已用完"
            )

        elder = await ElderRepository.get_by_id(db, invite.elder_id)
        if elder is None:
            return InviteCodeValidationResponse(
                valid=False, message="关联的老人档案不存在"
            )

        return InviteCodeValidationResponse(
            valid=True, elder_name=elder.name, message="邀请码有效"
        )
