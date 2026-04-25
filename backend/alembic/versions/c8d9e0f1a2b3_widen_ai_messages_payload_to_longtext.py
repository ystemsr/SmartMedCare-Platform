"""widen ai_messages.payload from TEXT to LONGTEXT

The chat payload embeds inline base64 images and tool/RAG metadata, which
routinely exceeds MySQL's 64KB TEXT cap and triggers
``Data too long for column 'payload'`` on insert.

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-04-25
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy.dialects import mysql


revision: str = "c8d9e0f1a2b3"
down_revision: Union[str, None] = "b7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "ai_messages",
        "payload",
        existing_type=mysql.TEXT(),
        type_=mysql.LONGTEXT(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "ai_messages",
        "payload",
        existing_type=mysql.LONGTEXT(),
        type_=mysql.TEXT(),
        existing_nullable=False,
    )
