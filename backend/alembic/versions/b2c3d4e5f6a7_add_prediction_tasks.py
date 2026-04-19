"""add prediction_tasks table + prediction permissions

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSIONS = [
    ("prediction:dispatch", "创建预测任务", "医生创建健康风险评估任务"),
    ("prediction:read", "查看预测任务", "查看预测任务列表与详情"),
]


def upgrade() -> None:
    op.create_table(
        "prediction_tasks",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("elder_id", sa.BigInteger(), nullable=False),
        sa.Column("doctor_user_id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.String(length=128), nullable=False, server_default="健康风险评估"),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending_elder"),
        sa.Column("auto_inputs", sa.JSON(), nullable=True),
        sa.Column("permanent_inputs", sa.JSON(), nullable=True),
        sa.Column("doctor_inputs", sa.JSON(), nullable=True),
        sa.Column("elder_requested_fields", sa.JSON(), nullable=False),
        sa.Column("elder_inputs", sa.JSON(), nullable=True),
        sa.Column("features_snapshot", sa.JSON(), nullable=True),
        sa.Column("prediction_result_id", sa.BigInteger(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("due_at", sa.DateTime(), nullable=True),
        sa.Column("elder_submitted_at", sa.DateTime(), nullable=True),
        sa.Column("predicted_at", sa.DateTime(), nullable=True),
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
    op.create_index("ix_prediction_tasks_elder_id", "prediction_tasks", ["elder_id"])
    op.create_index("ix_prediction_tasks_doctor_user_id", "prediction_tasks", ["doctor_user_id"])
    op.create_index("ix_prediction_tasks_status", "prediction_tasks", ["status"])

    for code, name, desc in NEW_PERMISSIONS:
        op.execute(
            sa.text(
                "INSERT IGNORE INTO permissions (code, name, description) "
                "VALUES (:code, :name, :desc)"
            ).bindparams(code=code, name=name, desc=desc)
        )

    # Grant admin + doctor prediction:dispatch / prediction:read.
    op.execute(
        """
        INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
          FROM roles r
          JOIN permissions p
            ON (r.name IN ('admin','doctor') AND p.code IN ('prediction:dispatch','prediction:read'))
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE rp FROM role_permissions rp
          JOIN permissions p ON rp.permission_id = p.id
         WHERE p.code IN ('prediction:dispatch','prediction:read')
        """
    )
    op.execute(
        "DELETE FROM permissions "
        "WHERE code IN ('prediction:dispatch','prediction:read')"
    )
    op.drop_index("ix_prediction_tasks_status", table_name="prediction_tasks")
    op.drop_index("ix_prediction_tasks_doctor_user_id", table_name="prediction_tasks")
    op.drop_index("ix_prediction_tasks_elder_id", table_name="prediction_tasks")
    op.drop_table("prediction_tasks")
