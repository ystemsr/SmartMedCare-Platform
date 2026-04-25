"""OpenAI-compatible embedding client for the RAG knowledge base.

Defaults target OpenRouter with the ``qwen/qwen3-embedding-8b`` model.
The base URL, key, and model are read from settings and can be
overridden per-environment without code changes.
"""

from __future__ import annotations

import logging
import os
from typing import List

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

EMBED_TIMEOUT = 60.0
BATCH_SIZE = 16


def _resolved_base_url() -> str:
    url = (settings.KB_EMBEDDING_BASE_URL or "").strip()
    if url:
        return url.rstrip("/")
    # Fallback to the assistant's own base URL.
    env = (os.getenv("AI_BASE_URL") or "").strip()
    if env and not env.lower().startswith("your_"):
        return env.rstrip("/")
    return "https://openrouter.ai/api/v1"


def _resolved_api_key() -> str:
    key = (settings.KB_EMBEDDING_API_KEY or "").strip()
    if key and not key.lower().startswith("your_"):
        return key
    # Fallback to the assistant's key — usually the same OpenRouter account.
    env = (os.getenv("AI_API_KEY") or "").strip()
    if env and not env.lower().startswith("your_"):
        return env
    return ""


def is_available() -> bool:
    return bool(_resolved_api_key())


class EmbeddingError(RuntimeError):
    pass


async def embed_texts(texts: List[str]) -> List[List[float]]:
    """Return one embedding per input text, in the same order."""
    if not texts:
        return []
    api_key = _resolved_api_key()
    if not api_key:
        raise EmbeddingError(
            "Embedding API key is not configured — set KB_EMBEDDING_API_KEY "
            "or AI_API_KEY in .env"
        )
    base_url = _resolved_base_url()
    model = (settings.KB_EMBEDDING_MODEL or "qwen/qwen3-embedding-8b").strip()
    url = f"{base_url}/embeddings"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://smartmedcare.local",
        "X-Title": "SmartMedCare",
    }

    out: List[List[float]] = []
    async with httpx.AsyncClient(timeout=EMBED_TIMEOUT) as client:
        # Batch to keep request sizes bounded even on huge documents.
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i : i + BATCH_SIZE]
            resp = await client.post(
                url,
                headers=headers,
                json={"model": model, "input": batch},
            )
            if resp.status_code != 200:
                raise EmbeddingError(
                    f"Embedding upstream HTTP {resp.status_code}: "
                    f"{resp.text[:300]}"
                )
            try:
                data = resp.json()
            except ValueError as e:
                raise EmbeddingError(f"Embedding response not JSON: {e}") from e
            rows = data.get("data") or []
            if len(rows) != len(batch):
                raise EmbeddingError(
                    f"Embedding returned {len(rows)} vectors for "
                    f"{len(batch)} inputs"
                )
            # Rows may come back unordered — trust the `index` field.
            ordered: List[List[float]] = [[] for _ in batch]
            for row in rows:
                idx = int(row.get("index", 0))
                emb = row.get("embedding") or []
                if not isinstance(emb, list):
                    raise EmbeddingError("Embedding row missing `embedding`")
                ordered[idx] = [float(x) for x in emb]
            out.extend(ordered)
    return out


async def embed_query(query: str) -> List[float]:
    """Shortcut for a single-text embedding."""
    vectors = await embed_texts([query])
    if not vectors:
        raise EmbeddingError("Embedding returned no vectors for query")
    return vectors[0]
