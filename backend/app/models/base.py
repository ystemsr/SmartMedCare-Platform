"""Declarative base and common mixins for all ORM models."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import BigInteger, DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _utcnow() -> datetime:
    """Return current UTC time as a naive datetime (tz stripped).

    All timestamps are stored as UTC; the DateTime column is naive, so we
    drop tzinfo after computing in UTC. The frontend converts to the user's
    device timezone for display.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base with type annotation map."""

    type_annotation_map = {
        int: BigInteger,
    }


class TimestampMixin:
    """Mixin that adds created_at and updated_at columns (UTC)."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=_utcnow,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=_utcnow,
        onupdate=_utcnow,
        server_default=func.now(),
    )


class SoftDeleteMixin:
    """Mixin that adds a deleted_at column for soft deletion."""

    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
        default=None,
    )


class BaseModel(Base, TimestampMixin, SoftDeleteMixin):
    """Abstract base model with id, timestamps, and soft delete.

    All business entity tables should inherit from this class.
    """

    __abstract__ = True

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )
