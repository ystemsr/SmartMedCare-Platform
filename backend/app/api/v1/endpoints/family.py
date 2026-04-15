"""Family member endpoints -- registration, self-service."""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.models.user import User
from app.schemas.family_member import FamilyRegisterRequest
from app.services.family_member import FamilyMemberService
from app.services.invite_code import InviteCodeService
from app.utils.response import (
    BUSINESS_VALIDATION_FAILED,
    NOT_FOUND,
    error_response,
    success_response,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/validate-code/{code}")
async def validate_invite_code(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """Validate an invite code (public, no auth required)."""
    result = await InviteCodeService.validate_code(db, code)
    return success_response(result.model_dump())


@router.post("/register")
async def register_family_member(
    body: FamilyRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Self-register as a family member using an invite code (public)."""
    result = await FamilyMemberService.register(db, body)
    if isinstance(result, str):
        return error_response(BUSINESS_VALIDATION_FAILED, result)
    return success_response(result, message="注册成功")


@router.get("/me")
async def get_family_self(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("family:read")),
):
    """Get current family member's profile and linked elder info."""
    info = await FamilyMemberService.get_my_info(db, current_user.id)
    if info is None:
        return error_response(NOT_FOUND, "未找到家属信息")
    return success_response(info.model_dump())


@router.get("/elder")
async def get_family_elder(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("family:read")),
):
    """Get the linked elder's info for the current family member."""
    info = await FamilyMemberService.get_linked_elder_info(db, current_user.id)
    if info is None:
        return error_response(NOT_FOUND, "未找到关联的老人信息")
    return success_response(info.model_dump())
