"""Knowledge base ORM models — documents and their chunks.

Each document is scoped to a role code (admin / doctor / elder / family)
so retrieval is strictly segregated per role.
"""

from sqlalchemy import BigInteger, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class KBDocument(BaseModel):
    """A single ingested document in the knowledge base."""

    __tablename__ = "kb_documents"
    __table_args__ = (
        Index("ix_kb_documents_role_code", "role_code"),
    )

    role_code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    file_type: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    size: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    # Status: pending | processing | ready | failed
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Optional link back to the FileRecord the raw bytes were stored under.
    file_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("file_records.id"), nullable=True
    )
    uploaded_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=True
    )


class KBChunk(BaseModel):
    """A single text chunk inside a KBDocument.

    The vector itself lives in Qdrant — this table stores the raw text so
    we can show citations and, if needed, rebuild the index without re-
    extracting the source file.
    """

    __tablename__ = "kb_chunks"
    __table_args__ = (
        Index("ix_kb_chunks_document_id", "document_id"),
    )

    document_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("kb_documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Qdrant point id (UUID string) so we can locate / delete a single chunk.
    vector_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
