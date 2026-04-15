"""Authentication request/response schemas."""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Login request body."""

    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1)
    captcha_id: str = Field(..., min_length=1)
    captcha_code: str = Field(..., min_length=1)


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


class CaptchaResponse(BaseModel):
    """Captcha response body."""

    captcha_id: str
    image: str  # base64 encoded image
