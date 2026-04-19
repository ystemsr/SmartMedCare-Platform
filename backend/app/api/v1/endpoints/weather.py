"""Weather info served from the backend-scheduled cache."""

import logging

from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.models.user import User
from app.services.weather import WeatherService
from app.utils.response import (
    BUSINESS_VALIDATION_FAILED,
    error_response,
    success_response,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/current")
async def get_current_weather(current_user: User = Depends(get_current_user)):
    """Return the latest cached weather snapshot.

    Data is refreshed by a backend background task (default every 30 min)
    so the frontend never calls OpenWeatherMap directly.
    """
    data = WeatherService.snapshot()
    if data is None:
        # First refresh may still be in flight — trigger once inline.
        await WeatherService.refresh()
        data = WeatherService.snapshot()
    if data is None:
        return error_response(BUSINESS_VALIDATION_FAILED, "天气信息暂不可用")
    return success_response(data)
