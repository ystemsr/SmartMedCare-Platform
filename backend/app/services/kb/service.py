"""High-level KB operations: ingest, list, delete, retrieve.

Ingest pipeline:
  1. Extract text from the uploaded file.
  2. Split into overlapping character chunks.
  3. Embed each chunk via the OpenAI-compatible embedding endpoint.
  4. Upsert the vectors into the role-scoped Qdrant collection.
  5. Persist a KBDocument row + one KBChunk per chunk in MySQL.

MySQL stores the raw chunk text so the UI can render citations and the
admin can delete / re-index without re-uploading the original file.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import qdrant_client
from app.core.config import settings
from app.models.knowledge_base import KBChunk, KBDocument
from app.services.kb.chunker import chunk_text
from app.services.kb.embedding import embed_query, embed_texts
from app.services.kb.extractor import (
    SUPPORTED_EXTENSIONS,
    UnsupportedFileType,
    detect_extension,
    extract_text,
)

logger = logging.getLogger(__name__)


# Role codes that can own KB documents. Kept in sync with the AI
# assistant's ROLE_CODES list.
ROLE_CODES: List[str] = ["admin", "doctor", "elder", "family"]


# Prompt template — must match the spec exactly (only {related_content}
# and {user_query} are substituted).
RAG_PROMPT_TEMPLATE = (
    "Use the following pieces of context to answer the question at the end.\n"
    "If you don't know the answer, just say that you don't know, don't try "
    "to make up an answer.\n"
    "\n"
    "{related_content}\n"
    "\n"
    "Question: {user_query}\n"
    "Helpful Answer:"
)


def is_supported(file_name: str) -> bool:
    return detect_extension(file_name) in SUPPORTED_EXTENSIONS


async def ingest_document(
    db: AsyncSession,
    *,
    role_code: str,
    file_name: str,
    data: bytes,
    uploaded_by: Optional[int] = None,
    file_id: Optional[int] = None,
) -> KBDocument:
    """Extract → chunk → embed → upsert → persist.

    Returns the saved KBDocument. Raises UnsupportedFileType or
    EmbeddingError on failure.
    """
    if role_code not in ROLE_CODES:
        raise ValueError(f"Unknown role_code: {role_code}")
    if not is_supported(file_name):
        raise UnsupportedFileType(
            f"Unsupported file type: {file_name} — allowed: "
            f"{', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )

    ext = detect_extension(file_name)
    doc = KBDocument(
        role_code=role_code,
        name=file_name,
        file_type=ext,
        size=len(data),
        status="processing",
        chunk_count=0,
        file_id=file_id,
        uploaded_by=uploaded_by,
    )
    db.add(doc)
    await db.flush()  # get doc.id

    try:
        text = extract_text(file_name, data)
        pieces = chunk_text(
            text,
            chunk_size=settings.KB_CHUNK_SIZE,
            overlap=settings.KB_CHUNK_OVERLAP,
        )
        if not pieces:
            raise ValueError("Document contained no extractable text")

        vectors = await embed_texts(pieces)
        if len(vectors) != len(pieces):
            raise RuntimeError(
                f"Embedding count mismatch: {len(vectors)} vs {len(pieces)}"
            )

        # Build Qdrant points + DB rows in lockstep so a vector id exists
        # for every stored chunk.
        points: List[Dict[str, Any]] = []
        chunk_rows: List[KBChunk] = []
        for i, (content, vector) in enumerate(zip(pieces, vectors)):
            vid = str(uuid.uuid4())
            points.append(
                {
                    "id": vid,
                    "vector": vector,
                    "payload": {
                        "document_id": doc.id,
                        "document_name": file_name,
                        "role_code": role_code,
                        "chunk_index": i,
                        "content": content,
                    },
                }
            )
            chunk_rows.append(
                KBChunk(
                    document_id=doc.id,
                    chunk_index=i,
                    content=content,
                    vector_id=vid,
                )
            )

        await qdrant_client.upsert_chunks(role_code, points)
        db.add_all(chunk_rows)

        doc.chunk_count = len(pieces)
        doc.status = "ready"
        doc.error_message = None
        await db.commit()
        await db.refresh(doc)
        logger.info(
            "kb ingest ok: role=%s doc=%s chunks=%s", role_code, doc.id, len(pieces)
        )
        return doc
    except Exception as e:  # noqa: BLE001
        logger.exception("kb ingest failed for role=%s file=%s", role_code, file_name)
        # Roll back any partial SQL state, then record the failure so the
        # admin UI can show it.
        await db.rollback()
        doc_retry = await db.get(KBDocument, doc.id)
        if doc_retry is not None:
            doc_retry.status = "failed"
            doc_retry.error_message = str(e)[:1000]
            await db.commit()
            await db.refresh(doc_retry)
            # Best-effort clean-up of any vectors that did land in Qdrant.
            await qdrant_client.delete_by_document(role_code, doc_retry.id)
            return doc_retry
        raise


async def list_documents(
    db: AsyncSession, role_code: Optional[str] = None
) -> List[KBDocument]:
    stmt = select(KBDocument).where(KBDocument.deleted_at.is_(None))
    if role_code:
        stmt = stmt.where(KBDocument.role_code == role_code)
    stmt = stmt.order_by(KBDocument.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    return list(rows)


async def delete_document(db: AsyncSession, document_id: int) -> bool:
    """Permanently remove a KB document and every place it lives.

    A KB document is purely reference material that backs the RAG
    feature — there is no audit value in keeping a soft-deleted shell
    around — so we fully erase it:
      1. MySQL: DELETE the chunks, then DELETE the document row.
      2. Qdrant: drop every vector tagged with this document_id in the
         role's collection.
    """
    doc = await db.get(KBDocument, document_id)
    if doc is None:
        return False
    role_code = doc.role_code

    await db.execute(delete(KBChunk).where(KBChunk.document_id == document_id))
    await db.execute(delete(KBDocument).where(KBDocument.id == document_id))
    await db.commit()

    # Vectors live outside the SQL transaction — clean up after the row
    # is gone so a Qdrant failure doesn't leave a dangling DB record.
    await qdrant_client.delete_by_document(role_code, document_id)
    logger.info("kb delete: role=%s doc=%s", role_code, document_id)
    return True


async def retrieve(
    role_code: str,
    query: str,
    *,
    top_k: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Return the top-k matching chunks for `query` in the role's collection.

    Each entry is `{id, score, document_id, document_name, chunk_index,
    content}`. Returns an empty list if the role has no documents or
    retrieval fails — callers should degrade gracefully.
    """
    if role_code not in ROLE_CODES:
        return []
    query = (query or "").strip()
    if not query:
        return []
    k = top_k or settings.KB_TOP_K
    try:
        vector = await embed_query(query)
    except Exception as e:  # noqa: BLE001
        logger.warning("kb retrieve embed failed: %s", e)
        return []
    hits = await qdrant_client.search(role_code, vector, k)
    out: List[Dict[str, Any]] = []
    for h in hits:
        payload = h.get("payload") or {}
        out.append(
            {
                "id": h.get("id"),
                "score": h.get("score"),
                "document_id": payload.get("document_id"),
                "document_name": payload.get("document_name") or "",
                "chunk_index": payload.get("chunk_index"),
                "content": payload.get("content") or "",
            }
        )
    return out


def build_rag_prompt(user_query: str, hits: List[Dict[str, Any]]) -> str:
    """Assemble the prompt using the spec's exact template."""
    if hits:
        parts = []
        for i, h in enumerate(hits, 1):
            name = h.get("document_name") or "unknown"
            idx = h.get("chunk_index")
            content = (h.get("content") or "").strip()
            header = f"[{i}] {name}" + (
                f" (chunk #{idx})" if idx is not None else ""
            )
            parts.append(f"{header}\n{content}")
        related = "\n\n".join(parts)
    else:
        related = "(no relevant context found in the knowledge base)"
    return RAG_PROMPT_TEMPLATE.format(
        related_content=related, user_query=user_query
    )
