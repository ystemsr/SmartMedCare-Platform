"""add survey_tasks, hive query history, saved queries, job metrics, new permissions

Revision ID: a1b2c3d4e5f6
Revises: 7c4d2a9b1e30
Create Date: 2026-04-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "7c4d2a9b1e30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSIONS = [
    ("survey:dispatch", "派发调查任务", "医生向老人派发健康信息调查"),
    ("survey:read", "查看调查任务", "查看调查任务列表与详情"),
    ("bigdata:analytics", "查看大数据分析", "查看多维统计与可视化分析"),
]


def upgrade() -> None:
    # ---- survey_tasks ----
    op.create_table(
        "survey_tasks",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("elder_id", sa.BigInteger(), nullable=False),
        sa.Column("doctor_user_id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("requested_fields", sa.JSON(), nullable=False),
        sa.Column("responses", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("due_at", sa.DateTime(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_survey_tasks_elder_id", "survey_tasks", ["elder_id"])
    op.create_index("ix_survey_tasks_doctor_user_id", "survey_tasks", ["doctor_user_id"])
    op.create_index("ix_survey_tasks_status", "survey_tasks", ["status"])

    # ---- hive_query_history ----
    op.create_table(
        "hive_query_history",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("sql", sa.Text(), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="success"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_hive_query_history_user_id", "hive_query_history", ["user_id"])

    # ---- hive_saved_queries ----
    op.create_table(
        "hive_saved_queries",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("sql", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_hive_saved_queries_user_id", "hive_saved_queries", ["user_id"])

    # ---- bigdata_jobs metrics columns ----
    op.add_column("bigdata_jobs", sa.Column("duration_ms", sa.Integer(), nullable=True))
    op.add_column("bigdata_jobs", sa.Column("rows_processed", sa.BigInteger(), nullable=True))

    # ---- Permissions ----
    for code, name, desc in NEW_PERMISSIONS:
        op.execute(
            sa.text(
                "INSERT IGNORE INTO permissions (code, name, description) "
                "VALUES (:code, :name, :desc)"
            ).bindparams(code=code, name=name, desc=desc)
        )

    # Grant admin + doctor survey:dispatch/read + bigdata:analytics
    op.execute(
        """
        INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
          FROM roles r
          JOIN permissions p
            ON (r.name IN ('admin','doctor') AND p.code IN ('survey:dispatch','survey:read','bigdata:analytics'))
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE rp FROM role_permissions rp
          JOIN permissions p ON rp.permission_id = p.id
         WHERE p.code IN ('survey:dispatch','survey:read','bigdata:analytics')
        """
    )
    op.execute(
        "DELETE FROM permissions "
        "WHERE code IN ('survey:dispatch','survey:read','bigdata:analytics')"
    )

    op.drop_column("bigdata_jobs", "rows_processed")
    op.drop_column("bigdata_jobs", "duration_ms")

    op.drop_index("ix_hive_saved_queries_user_id", table_name="hive_saved_queries")
    op.drop_table("hive_saved_queries")

    op.drop_index("ix_hive_query_history_user_id", table_name="hive_query_history")
    op.drop_table("hive_query_history")

    op.drop_index("ix_survey_tasks_status", table_name="survey_tasks")
    op.drop_index("ix_survey_tasks_doctor_user_id", table_name="survey_tasks")
    op.drop_index("ix_survey_tasks_elder_id", table_name="survey_tasks")
    op.drop_table("survey_tasks")
