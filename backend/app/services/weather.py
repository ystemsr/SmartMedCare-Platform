"""Background weather refresh service backed by OpenWeatherMap."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_OWM_URL = "https://api.openweathermap.org/data/2.5/weather"


class WeatherService:
    """Periodically fetches current weather and caches the latest snapshot."""

    _cache: Optional[Dict[str, Any]] = None
    _fetched_at: Optional[datetime] = None
    _task: Optional[asyncio.Task] = None
    _lock = asyncio.Lock()

    @classmethod
    async def _fetch_once(cls) -> Optional[Dict[str, Any]]:
        if not settings.WEATHER_API_KEY:
            return None
        params = {
            "q": settings.WEATHER_DEFAULT_CITY,
            "appid": settings.WEATHER_API_KEY,
            "units": "metric",
            "lang": "zh_cn",
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(_OWM_URL, params=params)
            if resp.status_code != 200:
                logger.warning(
                    "OpenWeatherMap returned %s: %s",
                    resp.status_code,
                    resp.text[:200],
                )
                return None
            payload = resp.json()
        except httpx.HTTPError:
            logger.exception("OpenWeatherMap request failed")
            return None

        weather_item = (payload.get("weather") or [{}])[0]
        main = payload.get("main") or {}
        wind = payload.get("wind") or {}
        return {
            "city": payload.get("name") or params["q"],
            "description": weather_item.get("description"),
            "icon": weather_item.get("icon"),
            "main": weather_item.get("main"),
            "temp": main.get("temp"),
            "feels_like": main.get("feels_like"),
            "temp_min": main.get("temp_min"),
            "temp_max": main.get("temp_max"),
            "humidity": main.get("humidity"),
            "wind_speed": wind.get("speed"),
        }

    @classmethod
    async def refresh(cls) -> None:
        async with cls._lock:
            data = await cls._fetch_once()
            if data is not None:
                cls._cache = data
                cls._fetched_at = datetime.now(timezone.utc)
                logger.info("Weather cache refreshed for %s", data.get("city"))

    @classmethod
    def snapshot(cls) -> Optional[Dict[str, Any]]:
        if cls._cache is None:
            return None
        data = dict(cls._cache)
        if cls._fetched_at is not None:
            data["fetched_at"] = cls._fetched_at.isoformat()
        return data

    @classmethod
    async def _run_loop(cls) -> None:
        interval = max(60, settings.WEATHER_REFRESH_SECONDS)
        logger.info("Weather refresh loop started (every %ss)", interval)
        while True:
            try:
                await cls.refresh()
            except Exception:
                logger.exception("Weather refresh iteration failed")
            try:
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                break

    @classmethod
    async def start(cls) -> None:
        if not settings.WEATHER_API_KEY:
            logger.info("WEATHER_API_KEY not set; weather service disabled")
            return
        if cls._task and not cls._task.done():
            return
        cls._task = asyncio.create_task(cls._run_loop(), name="weather-refresh")

    @classmethod
    async def stop(cls) -> None:
        if cls._task and not cls._task.done():
            cls._task.cancel()
            try:
                await cls._task
            except asyncio.CancelledError:
                pass
        cls._task = None
