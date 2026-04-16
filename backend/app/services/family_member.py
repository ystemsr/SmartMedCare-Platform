"""Business logic for family member registration and management."""

import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis_client import redis_delete, redis_get
from app.core.security import create_access_token, hash_password
from app.models.user import User, UserRole
from app.repositories.elder import ElderRepository
from app.repositories.family_member import FamilyMemberRepository
from app.repositories.invite_code import InviteCodeRepository
from app.repositories.user import UserRepository
from app.schemas.family_member import (
    FamilyElderInfoResponse,
    FamilyMemberResponse,
    FamilyRegisterRequest,
)

logger = logging.getLogger(__name__)

MAX_FAMILY_MEMBERS = 3


class FamilyMemberService:
    """Family member business operations."""

    @staticmethod
    async def list_all_members(db: AsyncSession, pagination):
        """List all family members for admin view."""
        return await FamilyMemberRepository.get_all_paginated(db, pagination)

    @staticmethod
    async def register(
        db: AsyncSession, data: FamilyRegisterRequest
    ) -> dict | str:
        """Register a new family member using an invite code.

        Returns dict with username on success, or error string.
        """
        # Validate slider captcha token (same pattern as AuthService.login)
        token_key = f"captcha_token:{data.captcha_token}"
        stored_session = await redis_get(token_key)
        if stored_session is None:
            return "验证码已过期"
        await redis_delete(token_key)
        if stored_session != data.session_id:
            return "验证码错误"

        # Lock and validate invite code
        invite = await InviteCodeRepository.get_by_code_for_update(db, data.invite_code)
        if invite is None:
            return "邀请码不存在"

        now = datetime.now(timezone.utc)
        if invite.expires_at.replace(tzinfo=timezone.utc) <= now:
            return "邀请码已过期"
        if invite.used_count >= invite.max_uses:
            return "邀请码已用完"

        # Check elder exists
        elder = await ElderRepository.get_by_id(db, invite.elder_id)
        if elder is None:
            return "关联的老人档案不存在"

        # Check family member count
        count = await FamilyMemberRepository.count_by_elder_id(db, invite.elder_id)
        if count >= MAX_FAMILY_MEMBERS:
            return "该老人已达到最大家属数量限制（3人）"

        # Check phone uniqueness as username
        username = data.phone
        existing = await UserRepository.get_by_username(db, username)
        if existing:
            return "该手机号已注册"

        # Create user account
        user = User(
            username=username,
            real_name=data.real_name,
            phone=data.phone,
            password_hash=hash_password(data.password),
            status="active",
        )
        db.add(user)
        await db.flush()

        # Assign family role (role_id=4)
        user_role = UserRole(user_id=user.id, role_id=4)
        db.add(user_role)

        # Create family member record
        await FamilyMemberRepository.create(
            db,
            user_id=user.id,
            elder_id=invite.elder_id,
            relationship=data.relationship,
        )

        # Increment invite code usage
        await InviteCodeRepository.increment_used_count(db, invite.id)

        await db.commit()

        # Generate access token so the frontend can auto-login after registration
        access_token = create_access_token({"sub": str(user.id)})

        logger.info(
            "Family member registered: user_id=%s elder_id=%s",
            user.id,
            invite.elder_id,
        )
        return {
            "username": username,
            "elder_name": elder.name,
            "access_token": access_token,
        }

    @staticmethod
    async def get_my_info(
        db: AsyncSession, user_id: int
    ) -> FamilyMemberResponse | None:
        """Get family member info by user ID."""
        member = await FamilyMemberRepository.get_by_user_id(db, user_id)
        if member is None:
            return None
        return FamilyMemberResponse(
            id=member.id,
            user_id=member.user_id,
            elder_id=member.elder_id,
            relationship=member.relationship,
            real_name=member.user.real_name if member.user else "",
            phone=member.user.phone if member.user else "",
            elder_name=member.elder.name if member.elder else "",
            created_at=member.created_at,
        )

    @staticmethod
    async def get_linked_elder_info(
        db: AsyncSession, user_id: int
    ) -> FamilyElderInfoResponse | None:
        """Get the linked elder's info for a family member."""
        member = await FamilyMemberRepository.get_by_user_id(db, user_id)
        if member is None:
            return None

        elder = await ElderRepository.get_by_id(db, member.elder_id)
        if elder is None:
            return None

        return FamilyElderInfoResponse(
            elder_id=elder.id,
            name=elder.name,
            gender=elder.gender,
            birth_date=elder.birth_date.isoformat() if elder.birth_date else None,
            phone=elder.phone,
            address=elder.address,
            emergency_contact_name=elder.emergency_contact_name,
            emergency_contact_phone=elder.emergency_contact_phone,
            tags=[t.tag_name for t in elder.tags],
        )
