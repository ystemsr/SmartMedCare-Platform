"""add primary_doctor_id to elders

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _drop_fks_on(table: str, column: str) -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT CONSTRAINT_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = :table
              AND COLUMN_NAME = :column
              AND REFERENCED_TABLE_NAME IS NOT NULL
            """
        ),
        {"table": table, "column": column},
    ).fetchall()
    for (name,) in rows:
        op.execute(f"ALTER TABLE `{table}` DROP FOREIGN KEY `{name}`")


def _drop_indexes_on(table: str, column: str) -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT INDEX_NAME
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = :table
              AND COLUMN_NAME = :column
              AND INDEX_NAME <> 'PRIMARY'
            GROUP BY INDEX_NAME
            HAVING COUNT(*) = 1
            """
        ),
        {"table": table, "column": column},
    ).fetchall()
    for (name,) in rows:
        op.execute(f"ALTER TABLE `{table}` DROP INDEX `{name}`")


def upgrade() -> None:
    # users.id is BIGINT UNSIGNED in init SQL — match exactly so the FK is
    # accepted by MySQL.
    op.add_column(
        "elders",
        sa.Column(
            "primary_doctor_id",
            mysql.BIGINT(unsigned=True),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_elders_primary_doctor_id", "elders", ["primary_doctor_id"]
    )
    op.create_foreign_key(
        "fk_elders_primary_doctor",
        "elders",
        "users",
        ["primary_doctor_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    _drop_fks_on("elders", "primary_doctor_id")
    _drop_indexes_on("elders", "primary_doctor_id")
    op.drop_column("elders", "primary_doctor_id")
