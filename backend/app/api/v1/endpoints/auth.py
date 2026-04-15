"""Authentication endpoints — login, logout, refresh, captcha, change password."""

import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, oauth2_scheme
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    TokenRefreshRequest,
)
from app.services.auth import AuthService
from app.utils.response import (
    BUSINESS_VALIDATION_FAILED,
    UNAUTHORIZED,
    error_response,
    success_response,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/login")
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user and return access/refresh tokens."""
    ip = request.client.host if request.client else ""
    user_agent = request.headers.get("user-agent", "")

    result = await AuthService.login(
        db=db,
        username=body.username,
        password=body.password,
        captcha_id=body.captcha_id,
        captcha_code=body.captcha_code,
        ip=ip,
        user_agent=user_agent,
    )
    if isinstance(result, str):
        return error_response(UNAUTHORIZED, result)
    return success_response(result.model_dump())


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Return current authenticated user info with permissions."""
    # Collect permissions from all roles
    permissions: set[str] = set()
    role_names: list[str] = []
    for ur in current_user.user_roles:
        role_names.append(ur.role.name)
        for rp in ur.role.role_permissions:
            permissions.add(rp.permission.code)

    data = {
        "id": current_user.id,
        "username": current_user.username,
        "real_name": current_user.real_name,
        "phone": current_user.phone,
        "roles": role_names,
        "permissions": sorted(permissions),
    }
    return success_response(data)


@router.post("/refresh")
async def refresh_token(
    body: TokenRefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Issue a new access token using a refresh token."""
    result = await AuthService.refresh(db, body.refresh_token)
    if isinstance(result, str):
        return error_response(UNAUTHORIZED, result)
    return success_response(result.model_dump())


@router.post("/logout")
async def logout(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
):
    """Blacklist the current access token."""
    await AuthService.logout(token)
    return success_response(message="已退出登录")


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change the current user's password."""
    error = await AuthService.change_password(db, current_user, body)
    if error is not None:
        return error_response(BUSINESS_VALIDATION_FAILED, error)
    return success_response(message="密码修改成功")


@router.get("/captcha")
async def get_captcha():
    """Generate and return a captcha image."""
    result = await AuthService.generate_captcha()
    return success_response(result.model_dump())
