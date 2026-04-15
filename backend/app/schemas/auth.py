"""Authentication request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Login request body."""

    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1)
    captcha_token: str = Field(..., min_length=1)
    session_id: str = Field(..., min_length=8, max_length=64)


class UserBrief(BaseModel):
    """Brief user info returned after login."""

    id: int
    username: str
    real_name: str
    roles: list[str]


class LoginResponse(BaseModel):
    """Login response body."""

    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: UserBrief


class TokenRefreshRequest(BaseModel):
    """Token refresh request body."""

    refresh_token: str


class TokenRefreshResponse(BaseModel):
    """Token refresh response body."""

    access_token: str
    token_type: str = "Bearer"
    expires_in: int


class ChangePasswordRequest(BaseModel):
    """Change password request body."""

    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


class CaptchaChallengeRequest(BaseModel):
    """Slider captcha challenge request body."""

    session_id: str = Field(..., min_length=8, max_length=64)


class CaptchaChallengeResponse(BaseModel):
    """Slider captcha challenge response body."""

    challenge_id: str
    width: int
    height: int
    thumb_y: int
    thumb_width: int
    thumb_height: int
    image: str  # base64 data URI
    thumb: str  # base64 data URI
    expires_at: datetime


class TrajectoryPoint(BaseModel):
    """Single point in the slider trajectory."""

    x: float
    t: float


class CaptchaVerifyRequest(BaseModel):
    """Slider captcha verification request body."""

    session_id: str = Field(..., min_length=8, max_length=64)
    challenge_id: str = Field(..., min_length=8, max_length=64)
    x: int
    y: int
    trajectory: list[TrajectoryPoint] = Field(..., min_length=3, max_length=500)


class CaptchaVerifyResponse(BaseModel):
    """Slider captcha verification response body."""

    captcha_token: str
