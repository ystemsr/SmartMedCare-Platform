"""Authentication service — login, logout, token refresh, captcha."""

import base64
import logging
import string
import uuid
from datetime import datetime, timezone
from io import BytesIO
from random import SystemRandom

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis_client import redis_delete, redis_get, redis_set
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.audit_log import LoginLog
from app.repositories.user import UserRepository
from app.schemas.auth import (
    CaptchaResponse,
    ChangePasswordRequest,
    LoginResponse,
    TokenRefreshResponse,
    UserBrief,
)

logger = logging.getLogger(__name__)

_rng = SystemRandom()


class AuthService:
    """Business logic for authentication operations."""

    @staticmethod
    async def login(
        db: AsyncSession,
        username: str,
        password: str,
        captcha_id: str,
        captcha_code: str,
        ip: str,
        user_agent: str,
    ) -> LoginResponse | str:
        """Authenticate a user and return tokens.

        Returns LoginResponse on success, or an error message string on failure.
        """
        # Validate captcha
        captcha_key = f"captcha:{captcha_id}"
        stored_code = await redis_get(captcha_key)
        if stored_code is None:
            await AuthService._record_login(db, None, ip, user_agent, "captcha_expired")
            return "验证码已过期"
        await redis_delete(captcha_key)
        if stored_code.lower() != captcha_code.lower():
            await AuthService._record_login(db, None, ip, user_agent, "captcha_invalid")
            return "验证码错误"

        # Find user
        user = await UserRepository.get_by_username(db, username)
        if user is None:
            await AuthService._record_login(db, None, ip, user_agent, "user_not_found")
            return "用户名或密码错误"

        # Verify password
        if not verify_password(password, user.password_hash):
            await AuthService._record_login(db, user.id, ip, user_agent, "wrong_password")
            return "用户名或密码错误"

        # Check status
        if user.status != "active":
            await AuthService._record_login(db, user.id, ip, user_agent, "account_disabled")
            return "账号已被禁用"

        # Create tokens
        token_data = {"sub": str(user.id)}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        # Store refresh token in Redis
        refresh_ttl = settings.JWT_REFRESH_TOKEN_EXPIRE_MINUTES * 60
        await redis_set(f"refresh_token:{user.id}", refresh_token, ttl=refresh_ttl)

        # Record successful login
        await AuthService._record_login(db, user.id, ip, user_agent, "success")

        # Build role names
        role_names = [ur.role.name for ur in user.user_roles]

        logger.info("User logged in: id=%s username=%s", user.id, user.username)

        return LoginResponse(
            access_token=access_token,
            token_type="Bearer",
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserBrief(
                id=user.id,
                username=user.username,
                real_name=user.real_name,
                roles=role_names,
            ),
        )

    @staticmethod
    async def logout(token: str) -> None:
        """Blacklist the current access token."""
        # Decode to get remaining TTL
        payload = decode_token(token)
        if payload and "exp" in payload:
            exp = payload["exp"]
            now = int(datetime.now(timezone.utc).timestamp())
            ttl = max(exp - now, 0)
        else:
            ttl = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60

        await redis_set(f"token_blacklist:{token}", "1", ttl=ttl)
        logger.info("Token blacklisted")

    @staticmethod
    async def refresh(db: AsyncSession, refresh_token: str) -> TokenRefreshResponse | str:
        """Issue a new access token from a valid refresh token.

        Returns TokenRefreshResponse on success, or an error message string on failure.
        """
        payload = decode_token(refresh_token)
        if payload is None:
            return "Refresh token无效或已过期"

        if payload.get("type") != "refresh":
            return "无效的token类型"

        user_id = payload.get("sub")
        if user_id is None:
            return "无效的token内容"

        # Verify the refresh token matches what we stored
        stored_token = await redis_get(f"refresh_token:{user_id}")
        if stored_token != refresh_token:
            return "Refresh token已失效"

        # Verify user still exists and is active
        user = await UserRepository.get_by_id(db, int(user_id))
        if user is None or user.status != "active":
            return "用户不存在或已禁用"

        new_access_token = create_access_token({"sub": str(user_id)})

        return TokenRefreshResponse(
            access_token=new_access_token,
            token_type="Bearer",
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    @staticmethod
    async def change_password(
        db: AsyncSession,
        user,
        data: ChangePasswordRequest,
    ) -> str | None:
        """Change the current user's password.

        Returns None on success, or an error message string on failure.
        """
        if not verify_password(data.old_password, user.password_hash):
            return "原密码错误"

        user.password_hash = hash_password(data.new_password)
        await db.commit()
        logger.info("Password changed for user: id=%s", user.id)
        return None

    @staticmethod
    async def generate_captcha() -> CaptchaResponse:
        """Generate a captcha image and store the code in Redis."""
        from captcha.image import ImageCaptcha

        # Generate random 4-char alphanumeric code
        chars = string.ascii_uppercase + string.digits
        code = "".join(_rng.choice(chars) for _ in range(4))

        # Create captcha image
        captcha = ImageCaptcha(width=160, height=60)
        image = captcha.generate_image(code)

        # Convert to base64
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        # Store in Redis with 5 minute TTL
        captcha_id = str(uuid.uuid4())
        await redis_set(f"captcha:{captcha_id}", code, ttl=300)

        return CaptchaResponse(
            captcha_id=captcha_id,
            image=f"data:image/png;base64,{image_base64}",
        )

    @staticmethod
    async def _record_login(
        db: AsyncSession,
        user_id: int | None,
        ip: str,
        user_agent: str,
        status: str,
    ) -> None:
        """Record a login attempt in the login_logs table."""
        log = LoginLog(
            user_id=user_id,
            login_time=datetime.now(timezone.utc),
            ip_address=ip,
            user_agent=user_agent,
            status=status,
        )
        db.add(log)
        await db.commit()
