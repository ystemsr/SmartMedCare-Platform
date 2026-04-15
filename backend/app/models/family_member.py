"""FamilyMember ORM model."""

from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship as sa_relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.elder import Elder


class FamilyMember(BaseModel):
    """Family member linked to an elder."""

    __tablename__ = "family_members"

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False
    )
    elder_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("elders.id"), nullable=False
    )
    relationship: Mapped[str] = mapped_column(String(32), nullable=False, default="")

    # ORM relationships
    user: Mapped["User"] = sa_relationship("User", foreign_keys=[user_id], lazy="selectin")
    elder: Mapped["Elder"] = sa_relationship("Elder", foreign_keys=[elder_id], lazy="selectin")
