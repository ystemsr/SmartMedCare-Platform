"""Elder and ElderTag ORM models."""

from datetime import date
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.invite_code import ElderInviteCode


class Elder(BaseModel):
    """Elderly person profile."""

    __tablename__ = "elders"

    name: Mapped[str] = mapped_column(String(64), nullable=False)
    gender: Mapped[str] = mapped_column(String(16), nullable=False, default="unknown")
    birth_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    id_card: Mapped[Optional[str]] = mapped_column(
        String(18), nullable=True, unique=True
    )
    phone: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    address: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    account_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="active"
    )
    account_password_hash: Mapped[str] = mapped_column(
        String(256), nullable=False, default=""
    )
    emergency_contact_name: Mapped[str] = mapped_column(
        String(64), nullable=False, default=""
    )
    emergency_contact_phone: Mapped[str] = mapped_column(
        String(20), nullable=False, default=""
    )

    # Relationships
    tags: Mapped[list["ElderTag"]] = relationship(
        "ElderTag",
        back_populates="elder",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    invite_codes: Mapped[list["ElderInviteCode"]] = relationship(
        "ElderInviteCode",
        back_populates="elder",
        lazy="noload",
    )


class ElderTag(BaseModel):
    """Tag associated with an elder."""

    __tablename__ = "elder_tags"

    elder_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("elders.id"), nullable=False
    )
    tag_name: Mapped[str] = mapped_column(String(64), nullable=False)

    # Relationships
    elder: Mapped["Elder"] = relationship("Elder", back_populates="tags")
