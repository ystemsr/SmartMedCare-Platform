"""Async MinIO client wrapper for S3-compatible object storage."""

import logging
from io import BytesIO
from typing import Optional

from miniopy_async import Minio

from app.core.config import settings

logger = logging.getLogger(__name__)

minio_client: Optional[Minio] = None


async def init_minio() -> None:
    """Initialize MinIO client and ensure the default bucket exists."""
    global minio_client
    minio_client = Minio(
        endpoint=settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE,
    )
    # Ensure the default bucket exists
    bucket_exists = await minio_client.bucket_exists(settings.MINIO_BUCKET)
    if not bucket_exists:
        await minio_client.make_bucket(settings.MINIO_BUCKET)
        logger.info("Created MinIO bucket: %s", settings.MINIO_BUCKET)
    logger.info("MinIO client initialized")


async def upload_file(
    object_key: str,
    data: bytes,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload a file to MinIO. Returns the object key."""
    if minio_client is None:
        raise RuntimeError("MinIO client not initialized")
    stream = BytesIO(data)
    await minio_client.put_object(
        bucket_name=settings.MINIO_BUCKET,
        object_name=object_key,
        data=stream,
        length=len(data),
        content_type=content_type,
    )
    logger.info("Uploaded object: %s", object_key)
    return object_key


async def get_presigned_url(
    object_key: str,
    expires_seconds: int = 3600,
) -> str:
    """Generate a presigned download URL for an object."""
    if minio_client is None:
        raise RuntimeError("MinIO client not initialized")
    from datetime import timedelta

    url = await minio_client.presigned_get_object(
        bucket_name=settings.MINIO_BUCKET,
        object_name=object_key,
        expires=timedelta(seconds=expires_seconds),
    )
    return url


async def delete_file(object_key: str) -> None:
    """Delete an object from MinIO."""
    if minio_client is None:
        raise RuntimeError("MinIO client not initialized")
    await minio_client.remove_object(
        bucket_name=settings.MINIO_BUCKET,
        object_name=object_key,
    )
    logger.info("Deleted object: %s", object_key)


async def check_health() -> bool:
    """Check if MinIO is reachable by listing buckets."""
    if minio_client is None:
        return False
    try:
        await minio_client.bucket_exists(settings.MINIO_BUCKET)
        return True
    except Exception:
        logger.exception("MinIO health check failed")
        return False
