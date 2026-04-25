"""AI knowledge base (RAG) services."""

from app.services.kb.service import (
    ROLE_CODES,
    build_rag_prompt,
    delete_document,
    ingest_document,
    list_documents,
    retrieve,
)

__all__ = [
    "ROLE_CODES",
    "build_rag_prompt",
    "delete_document",
    "ingest_document",
    "list_documents",
    "retrieve",
]
