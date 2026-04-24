"""AI knowledge base admin endpoints.

All endpoints require the ``ai:kb:manage`` permission so that only
administrators can curate the knowledge base. Per-role segregation is
enforced by the service layer — every document belongs to exactly one
role code and retrieval only looks at that role's collection.
"""

from __future__ import annotations

import asyncio
import logging
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.deps import get_db, require_permission
from app.schemas.kb import (
    KBDocumentListOut,
    KBDocumentOut,
    KBPreviewHit,
    KBPreviewOut,
    KBUploadBatchOut,
    KBUploadResult,
)
from app.services.kb import (
    ROLE_CODES,
    delete_document,
    ingest_document,
    list_documents,
    retrieve,
)
from app.services.kb.extractor import SUPPORTED_EXTENSIONS, UnsupportedFileType
from app.services.kb.util import sanitize_filename
from app.utils.response import (
    NOT_FOUND,
    PARAM_ERROR,
    error_response,
    success_response,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Cap how many documents we ingest concurrently. The embedding endpoint
# is the real bottleneck — going beyond ~5 tends to trip upstream rate
# limits without meaningfully improving throughput.
_MAX_CONCURRENT_INGEST = 5


@router.get("/roles")
async def list_roles(
    _user=Depends(require_permission("ai:kb:manage")),
):
    """List the role codes that can own KB documents."""
    return success_response(
        {
            "roles": ROLE_CODES,
            "supported_extensions": sorted(SUPPORTED_EXTENSIONS),
        }
    )


@router.get("/documents")
async def list_kb_documents(
    role_code: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("ai:kb:manage")),
):
    if role_code and role_code not in ROLE_CODES:
        return error_response(PARAM_ERROR, f"未知角色: {role_code}")
    rows = await list_documents(db, role_code)
    return success_response(
        KBDocumentListOut(
            items=[KBDocumentOut.model_validate(r) for r in rows]
        ).model_dump(mode="json")
    )


@router.post("/documents")
async def upload_kb_documents(
    files: List[UploadFile] = File(...),
    role_code: str = Form(...),
    current_user=Depends(require_permission("ai:kb:manage")),
):
    """Upload one or more files into the role's knowledge base.

    Files are ingested concurrently (bounded by ``_MAX_CONCURRENT_INGEST``)
    so a batch of N documents completes in roughly ``ceil(N/5)`` rounds
    of embedding rather than serially. One failure (unsupported format,
    extraction error, embedding rate-limit, ...) never aborts the rest
    of the batch — every file gets its own entry in the response.
    """
    if role_code not in ROLE_CODES:
        return error_response(PARAM_ERROR, f"未知角色: {role_code}")
    if not files:
        return error_response(PARAM_ERROR, "未选择文件")

    # Step 1 — read every uploaded file on the request thread. An
    # UploadFile wraps a single stream backed by the incoming request
    # body; once we fan out to worker tasks, each worker needs its own
    # in-memory bytes object.
    pending: List[Tuple[str, bytes, Optional[str]]] = []
    for f in files:
        name = sanitize_filename(f.filename)
        try:
            data = await f.read()
        except Exception:  # noqa: BLE001
            logger.exception("kb upload read failed for %s", name)
            pending.append((name, b"", "读取文件失败"))
            continue
        if not data:
            pending.append((name, b"", "文件内容为空"))
            continue
        pending.append((name, data, None))

    # Step 2 — ingest in parallel, capped by a semaphore. Each worker
    # opens its own DB session (async sessions are NOT safe to share
    # across concurrent tasks) and handles its own errors so the
    # overall batch always returns a full result list.
    sem = asyncio.Semaphore(_MAX_CONCURRENT_INGEST)
    uploader_id = current_user.id

    async def _ingest_one(
        name: str, data: bytes, read_error: Optional[str]
    ) -> KBUploadResult:
        if read_error is not None:
            return KBUploadResult(name=name, ok=False, error=read_error)
        async with sem:
            async with AsyncSessionLocal() as db:
                try:
                    doc = await ingest_document(
                        db,
                        role_code=role_code,
                        file_name=name,
                        data=data,
                        uploaded_by=uploader_id,
                    )
                except UnsupportedFileType as e:
                    return KBUploadResult(name=name, ok=False, error=str(e))
                except ValueError as e:
                    return KBUploadResult(name=name, ok=False, error=str(e))
                except Exception as e:  # noqa: BLE001
                    logger.exception("kb ingest failed for %s", name)
                    return KBUploadResult(
                        name=name, ok=False, error=f"知识库处理失败: {e}"
                    )
                # `ingest_document` returns a failed-status row for errors
                # discovered after the DB row was created — surface those
                # as batch-level failures too.
                ok = doc.status == "ready"
                return KBUploadResult(
                    name=name,
                    ok=ok,
                    error=None if ok else (doc.error_message or "处理失败"),
                    document=KBDocumentOut.model_validate(doc),
                )

    results = await asyncio.gather(
        *[_ingest_one(n, d, err) for n, d, err in pending]
    )

    return success_response(
        KBUploadBatchOut(items=list(results)).model_dump(mode="json")
    )


@router.delete("/documents/{document_id}")
async def delete_kb_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("ai:kb:manage")),
):
    ok = await delete_document(db, document_id)
    if not ok:
        return error_response(NOT_FOUND, "文档不存在")
    return success_response(message="已删除")


@router.get("/preview")
async def preview_search(
    role_code: str = Query(...),
    q: str = Query(..., min_length=1, max_length=500),
    top_k: int = Query(5, ge=1, le=20),
    _user=Depends(require_permission("ai:kb:manage")),
):
    """Run a retrieval query against a role's KB — admin sanity check."""
    if role_code not in ROLE_CODES:
        return error_response(PARAM_ERROR, f"未知角色: {role_code}")
    hits = await retrieve(role_code, q, top_k=top_k)
    return success_response(
        KBPreviewOut(
            hits=[
                KBPreviewHit(
                    document_id=h.get("document_id"),
                    document_name=h.get("document_name", ""),
                    chunk_index=h.get("chunk_index"),
                    score=float(h.get("score") or 0.0),
                    content=h.get("content") or "",
                )
                for h in hits
            ]
        ).model_dump(mode="json")
    )
