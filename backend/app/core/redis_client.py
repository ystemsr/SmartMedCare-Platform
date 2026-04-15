"""Async Redis client wrapper."""

import logging
from typing import Any, Optional

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client: Optional[aioredis.Redis] = None


async def init_redis() -> None:
    """Initialize the Redis connection pool."""
    global redis_client
    redis_client = aioredis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        decode_responses=True,
    )
    logger.info("Redis connection pool initialized")


async def close_redis() -> None:
    """Gracefully close the Redis connection pool."""
    global redis_client
    if redis_client is not None:
        await redis_client.close()
        redis_client = None
        logger.info("Redis connection pool closed")


async def redis_get(key: str) -> Optional[str]:
    """Get a value from Redis by key."""
    if redis_client is None:
        return None
    return await redis_client.get(key)


async def redis_set(key: str, value: Any, ttl: Optional[int] = None) -> bool:
    """Set a key-value pair in Redis with optional TTL in seconds."""
    if redis_client is None:
        return False
    if ttl is not None:
        return await redis_client.set(key, value, ex=ttl)
    return await redis_client.set(key, value)


async def redis_delete(key: str) -> int:
    """Delete a key from Redis. Returns number of keys removed."""
    if redis_client is None:
        return 0
    return await redis_client.delete(key)


async def redis_exists(key: str) -> bool:
    """Check if a key exists in Redis."""
    if redis_client is None:
        return False
    return bool(await redis_client.exists(key))
