"""File record and file binding ORM models."""

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BaseModel


class FileRecord(BaseModel):
    """Metadata for an uploaded file stored in MinIO."""

    __tablename__ = "file_records"

    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    object_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="general")
    elder_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("elders.id"), nullable=True
    )
    uploaded_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=True
    )


class FileBinding(Base):
    """Links a file to a business record. No soft delete, no timestamps."""

    __tablename__ = "file_bindings"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    file_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("file_records.id"), nullable=False
    )
    biz_type: Mapped[str] = mapped_column(String(64), nullable=False)
    biz_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
