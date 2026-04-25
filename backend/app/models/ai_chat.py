"""AI chat ORM models — per-user conversations and their messages.

Each conversation belongs to a single user (FK to `users`). Messages are
stored as a JSON payload that preserves the full UI message shape
(content, reasoning, images, tool-call results, knowledge-base hits) so
the chat UI can round-trip without losing bubble metadata.
"""

from sqlalchemy import BigInteger, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class AIConversation(BaseModel):
    """A user-owned AI chat conversation."""

    __tablename__ = "ai_conversations"
    __table_args__ = (
        Index("ix_ai_conversations_user_id", "user_id"),
    )

    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False, default="")


class AIMessage(BaseModel):
    """A single message inside an AIConversation.

    `payload` holds the full UI-side message object (images, reasoning,
    searches, knowledge_base, etc.) serialized as a JSON string so the
    chat UI can restore every bubble exactly as the user left it.
    """

    __tablename__ = "ai_messages"
    __table_args__ = (
        Index("ix_ai_messages_conversation_id", "conversation_id"),
    )

    conversation_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("ai_conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Ordering within the conversation. Messages are always returned in
    # ascending position order.
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="user")
    payload: Mapped[str] = mapped_column(LONGTEXT, nullable=False, default="{}")
