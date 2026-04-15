"""ElderInviteCode ORM model."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.elder import Elder


class ElderInviteCode(BaseModel):
    """Invite code for family member registration."""

    __tablename__ = "elder_invite_codes"

    elder_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("elders.id"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(16), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_uses: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    # Relationships
    elder: Mapped["Elder"] = relationship("Elder", back_populates="invite_codes")
