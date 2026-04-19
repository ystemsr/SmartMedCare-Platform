"""Hive query history and saved-query ORM models."""

from typing import Optional

from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class HiveQueryHistory(BaseModel):
    """Audit log of Hive queries a user has executed."""

    __tablename__ = "hive_query_history"

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False, index=True
    )
    sql: Mapped[str] = mapped_column(Text, nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="success"
    )  # success | failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class HiveSavedQuery(BaseModel):
    """User-saved Hive query templates."""

    __tablename__ = "hive_saved_queries"

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    sql: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
