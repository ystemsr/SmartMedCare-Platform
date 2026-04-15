"""Authentication service — login, logout, token refresh, captcha."""

import json
import logging
import uuid
from datetime import datetime, timezone

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
    CaptchaChallengeRequest,
    CaptchaChallengeResponse,
    CaptchaVerifyRequest,
    CaptchaVerifyResponse,
    ChangePasswordRequest,
    LoginResponse,
    TokenRefreshResponse,
    UserBrief,
)
from app.services.captcha import (
    CAPTCHA_EXPIRE_SECONDS,
    CAPTCHA_HEIGHT,
    CAPTCHA_PIECE_SIZE,
    CAPTCHA_TOLERANCE,
    CAPTCHA_WIDTH,
    build_slide_images,
    validate_trajectory,
)

logger = logging.getLogger(__name__)


class AuthService:
    """Business logic for authentication operations."""

    @staticmethod
    async def login(
        db: AsyncSession,
        username: str,
        password: str,
        captcha_token: str,
        session_id: str,
        ip: str,
        user_agent: str,
    ) -> LoginResponse | str:
        """Authenticate a user and return tokens.

        Returns LoginResponse on success, or an error message string on failure.
        """
        # Validate slider captcha token
        token_key = f"captcha_token:{captcha_token}"
        stored_session = await redis_get(token_key)
        if stored_session is None:
            await AuthService._record_login(db, None, ip, user_agent, "captcha_expired")
            return "验证码已过期"
        await redis_delete(token_key)
        if stored_session != session_id:
            await AuthService._record_login(db, None, ip, user_agent, "captcha_invalid")
            return "验证码错误"

        # Find user by username or phone
        user = await UserRepository.get_by_username(db, username)
        if user is None:
            user = await UserRepository.get_by_phone(db, username)
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
    async def generate_captcha(
        data: CaptchaChallengeRequest,
    ) -> CaptchaChallengeResponse:
        """Generate a slider puzzle captcha challenge and store in Redis."""
        image_uri, thumb_uri, x, y = build_slide_images()

        challenge_id = uuid.uuid4().hex
        expires_at = datetime.now(timezone.utc).timestamp() + CAPTCHA_EXPIRE_SECONDS

        payload = json.dumps(
            {
                "expected_x": x,
                "expected_y": y,
                "session_id": data.session_id,
            }
        )
        await redis_set(
            f"captcha:{challenge_id}", payload, ttl=CAPTCHA_EXPIRE_SECONDS
        )

        logger.info("Captcha challenge created: challenge_id=%s", challenge_id)

        return CaptchaChallengeResponse(
            challenge_id=challenge_id,
            width=CAPTCHA_WIDTH,
            height=CAPTCHA_HEIGHT,
            thumb_y=y,
            thumb_width=CAPTCHA_PIECE_SIZE,
            thumb_height=CAPTCHA_PIECE_SIZE,
            image=image_uri,
            thumb=thumb_uri,
            expires_at=datetime.fromtimestamp(expires_at, tz=timezone.utc),
        )

    @staticmethod
    async def verify_captcha(
        data: CaptchaVerifyRequest,
    ) -> CaptchaVerifyResponse | str:
        """Verify the slider captcha position and trajectory.

        Returns CaptchaVerifyResponse on success, or an error message string on failure.
        """
        captcha_key = f"captcha:{data.challenge_id}"
        stored = await redis_get(captcha_key)
        if stored is None:
            return "验证码已过期"
        await redis_delete(captcha_key)

        challenge = json.loads(stored)
        if challenge["session_id"] != data.session_id:
            return "验证码会话不匹配"

        expected_x = challenge["expected_x"]
        expected_y = challenge["expected_y"]

        # Validate trajectory behavior
        fail_reason = validate_trajectory(
            data.trajectory, expected_x, CAPTCHA_TOLERANCE
        )
        if fail_reason:
            return fail_reason

        # Validate final position
        if (
            abs(data.x - expected_x) > CAPTCHA_TOLERANCE
            or abs(data.y - expected_y) > CAPTCHA_TOLERANCE
        ):
            return "滑块位置不正确，请重试"

        # Store verified token in Redis
        await redis_set(
            f"captcha_token:{data.challenge_id}",
            data.session_id,
            ttl=CAPTCHA_EXPIRE_SECONDS,
        )

        logger.info(
            "Captcha verified: challenge_id=%s", data.challenge_id
        )

        return CaptchaVerifyResponse(captcha_token=data.challenge_id)

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
