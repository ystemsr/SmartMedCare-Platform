"""add kb_documents and kb_chunks for RAG knowledge base

Adds the two tables that back the per-role RAG knowledge base. The
vectors themselves live in Qdrant; these tables store the raw text so
the UI can render citations and admins can re-index without re-
extracting the source file.

Also grants the ``ai:kb:manage`` permission to the admin role so the
admin UI for uploading / deleting KB documents is reachable out of the
box.

Revision ID: a1b2c3d4e5f7
Revises: f6a7b8c9d0e1
Create Date: 2026-04-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql


revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # All BIGINT columns that participate in FKs to existing tables must
    # be UNSIGNED — `users.id` and `file_records.id` are both unsigned,
    # and MySQL rejects an FK where the signedness differs (error 3780).
    op.create_table(
        "kb_documents",
        sa.Column(
            "id",
            mysql.BIGINT(unsigned=True),
            primary_key=True,
            autoincrement=True,
        ),
        sa.Column("role_code", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=512), nullable=False),
        sa.Column("file_type", sa.String(length=32), nullable=False, server_default=""),
        sa.Column("size", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "file_id",
            mysql.BIGINT(unsigned=True),
            sa.ForeignKey("file_records.id"),
            nullable=True,
        ),
        sa.Column(
            "uploaded_by",
            mysql.BIGINT(unsigned=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_kb_documents_role_code", "kb_documents", ["role_code"])

    op.create_table(
        "kb_chunks",
        sa.Column(
            "id",
            mysql.BIGINT(unsigned=True),
            primary_key=True,
            autoincrement=True,
        ),
        sa.Column("document_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("vector_id", sa.String(length=64), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["document_id"], ["kb_documents.id"], ondelete="CASCADE"
        ),
    )
    op.create_index("ix_kb_chunks_document_id", "kb_chunks", ["document_id"])

    # Permission for KB admin endpoints.
    op.execute(
        sa.text(
            "INSERT IGNORE INTO permissions (code, name, description) "
            "VALUES (:code, :name, :desc)"
        ).bindparams(
            code="ai:kb:manage",
            name="管理 AI 知识库",
            desc="上传、删除、重建 AI 助手知识库文档",
        )
    )
    op.execute(
        """
        INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
          FROM roles r
          JOIN permissions p ON p.code = 'ai:kb:manage'
         WHERE r.name = 'admin'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE rp FROM role_permissions rp
          JOIN permissions p ON rp.permission_id = p.id
         WHERE p.code = 'ai:kb:manage'
        """
    )
    op.execute("DELETE FROM permissions WHERE code = 'ai:kb:manage'")

    op.drop_index("ix_kb_chunks_document_id", table_name="kb_chunks")
    op.drop_table("kb_chunks")
    op.drop_index("ix_kb_documents_role_code", table_name="kb_documents")
    op.drop_table("kb_documents")
