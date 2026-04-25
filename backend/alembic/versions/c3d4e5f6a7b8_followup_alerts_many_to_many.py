"""promote followups.alert_id to a followup_alerts join table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _drop_fks_on(table: str, column: str) -> None:
    """Drop every foreign key on `table.column`. MySQL FK names are auto-
    generated and may differ between environments, so we look them up rather
    than guess."""
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
    """Drop any indexes that contain only `column` (so the column can be
    dropped cleanly on MySQL, which keeps an implicit index for FKs)."""
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
    # followups.id and alerts.id are BIGINT UNSIGNED (from the legacy init
    # SQL); the join columns must match exactly or MySQL rejects the FKs.
    op.create_table(
        "followup_alerts",
        sa.Column("followup_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("alert_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["followup_id"], ["followups.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["alert_id"], ["alerts.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("followup_id", "alert_id"),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index(
        "ix_followup_alerts_alert_id", "followup_alerts", ["alert_id"]
    )

    op.execute(
        """
        INSERT INTO followup_alerts (followup_id, alert_id)
        SELECT f.id, f.alert_id
        FROM followups f
        WHERE f.alert_id IS NOT NULL
          AND f.deleted_at IS NULL
        """
    )

    _drop_fks_on("followups", "alert_id")
    _drop_indexes_on("followups", "alert_id")
    op.drop_column("followups", "alert_id")


def downgrade() -> None:
    op.add_column(
        "followups",
        sa.Column("alert_id", mysql.BIGINT(unsigned=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_followups_alert_id",
        "followups",
        "alerts",
        ["alert_id"],
        ["id"],
    )

    op.execute(
        """
        UPDATE followups f
        JOIN (
            SELECT followup_id, MIN(alert_id) AS alert_id
            FROM followup_alerts
            GROUP BY followup_id
        ) fa ON fa.followup_id = f.id
        SET f.alert_id = fa.alert_id
        """
    )

    op.drop_index("ix_followup_alerts_alert_id", table_name="followup_alerts")
    op.drop_table("followup_alerts")
