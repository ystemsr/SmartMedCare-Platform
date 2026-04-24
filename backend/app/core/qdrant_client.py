"""Async Qdrant client wrapper for the RAG knowledge base.

Each role (admin / doctor / elder / family) gets its own Qdrant collection
so retrieval never leaks context across roles. Collections are created
lazily on first write.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from qdrant_client import AsyncQdrantClient, models
from qdrant_client.http.exceptions import UnexpectedResponse

from app.core.config import settings

logger = logging.getLogger(__name__)

# Role code -> Qdrant collection name.
_COLLECTION_PREFIX = "kb_"


def collection_name(role_code: str) -> str:
    return f"{_COLLECTION_PREFIX}{role_code}"


_client: Optional[AsyncQdrantClient] = None


def get_client() -> AsyncQdrantClient:
    """Return a lazily-created async Qdrant client."""
    global _client
    if _client is None:
        _client = AsyncQdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY or None,
            prefer_grpc=False,
        )
    return _client


async def ensure_collection(role_code: str) -> None:
    """Create the collection for `role_code` if it does not exist."""
    client = get_client()
    name = collection_name(role_code)
    try:
        await client.get_collection(name)
        return
    except (UnexpectedResponse, ValueError):
        pass
    except Exception as e:  # noqa: BLE001
        # qdrant-client raises its own not-found subclass; fall through.
        logger.debug("qdrant get_collection(%s) probe: %s", name, e)

    await client.create_collection(
        collection_name=name,
        vectors_config=models.VectorParams(
            size=settings.KB_EMBEDDING_DIM,
            distance=models.Distance.COSINE,
        ),
    )
    logger.info("qdrant collection created: %s", name)


async def upsert_chunks(
    role_code: str,
    points: List[Dict[str, Any]],
) -> None:
    """Upsert a batch of chunks.

    `points` entries must contain `id` (int | str), `vector` (list[float]),
    and `payload` (dict).
    """
    if not points:
        return
    await ensure_collection(role_code)
    client = get_client()
    await client.upsert(
        collection_name=collection_name(role_code),
        points=[
            models.PointStruct(
                id=p["id"],
                vector=p["vector"],
                payload=p.get("payload") or {},
            )
            for p in points
        ],
    )


async def delete_by_document(role_code: str, document_id: int) -> None:
    """Remove all chunks belonging to a document from the role's collection."""
    client = get_client()
    try:
        await client.delete(
            collection_name=collection_name(role_code),
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="document_id",
                            match=models.MatchValue(value=document_id),
                        )
                    ]
                )
            ),
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(
            "qdrant delete for role=%s doc=%s failed: %s",
            role_code,
            document_id,
            e,
        )


async def search(
    role_code: str,
    vector: List[float],
    top_k: int,
) -> List[Dict[str, Any]]:
    """Return the top-k matches for `vector` inside the role's collection.

    Uses ``query_points`` (the only search entry point exposed on modern
    ``AsyncQdrantClient`` — the older ``search`` method was removed in
    qdrant-client 1.x). Returns an empty list when the collection does
    not yet exist; every other failure is logged loudly so a broken
    retrieval path can't silently degrade into "0 hits forever".
    """
    client = get_client()
    name = collection_name(role_code)
    try:
        resp = await client.query_points(
            collection_name=name,
            query=vector,
            limit=top_k,
            with_payload=True,
        )
    except Exception as e:  # noqa: BLE001
        # Missing-collection is the only benign case — every other error
        # (auth, network, dim-mismatch, bad payload) should surface.
        msg = str(e).lower()
        if "not found" in msg or "doesn't exist" in msg or "does not exist" in msg:
            logger.info("qdrant collection %s not present yet", name)
            return []
        logger.exception("qdrant query_points failed for %s", name)
        return []
    points = getattr(resp, "points", None) or []
    return [
        {
            "id": h.id,
            "score": float(h.score),
            "payload": dict(h.payload or {}),
        }
        for h in points
    ]
