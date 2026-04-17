"""Thin WebHDFS REST client used by big data endpoints."""

from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

from app.schemas.bigdata import (
    HdfsFileEntry,
    HdfsListResponse,
    HdfsPreviewResponse,
)

logger = logging.getLogger(__name__)


def _namenode_url() -> str:
    return os.environ.get("HDFS_NAMENODE_URL", "http://hadoop-namenode:9870").rstrip("/")


def _hdfs_user() -> str:
    return os.environ.get("HDFS_USER", "root")


def _webhdfs_url(path: str) -> str:
    if not path.startswith("/"):
        path = "/" + path
    return f"{_namenode_url()}/webhdfs/v1{path}"


async def list_path(path: str = "/") -> HdfsListResponse:
    """Call WebHDFS LISTSTATUS on the given path."""
    url = _webhdfs_url(path)
    params = {"op": "LISTSTATUS", "user.name": _hdfs_user()}
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params, follow_redirects=True)
        resp.raise_for_status()
        data = resp.json()

    raw = data.get("FileStatuses", {}).get("FileStatus", []) or []
    entries = [
        HdfsFileEntry(
            name=item.get("pathSuffix", ""),
            type=item.get("type", "FILE"),
            size=int(item.get("length", 0) or 0),
            modified=item.get("modificationTime"),
            owner=item.get("owner", ""),
            group=item.get("group", ""),
            permission=item.get("permission", ""),
        )
        for item in raw
    ]
    return HdfsListResponse(path=path, entries=entries)


async def read_file(path: str, lines: int = 200, max_bytes: int = 1_048_576) -> HdfsPreviewResponse:
    """Read the head of a HDFS file via WebHDFS OPEN. Caps at `max_bytes`."""
    url = _webhdfs_url(path)
    params = {
        "op": "OPEN",
        "user.name": _hdfs_user(),
        "length": str(max_bytes),
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url, params=params, follow_redirects=True)
        resp.raise_for_status()
        raw = resp.content[:max_bytes]

    try:
        text = raw.decode("utf-8", errors="replace")
    except Exception:  # pragma: no cover
        text = ""

    all_lines = text.splitlines()
    truncated = len(all_lines) > lines or len(raw) >= max_bytes
    head_lines = all_lines[:lines]
    return HdfsPreviewResponse(path=path, lines=head_lines, truncated=truncated)
