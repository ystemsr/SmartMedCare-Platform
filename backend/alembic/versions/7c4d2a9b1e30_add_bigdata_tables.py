"""add bigdata tables, ml permissions, and default grants

Revision ID: 7c4d2a9b1e30
Revises: 61a7970ac65e
Create Date: 2026-04-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "7c4d2a9b1e30"
down_revision: Union[str, None] = "61a7970ac65e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSIONS = [
    ("bigdata:read", "查看大数据", "查看大数据任务、HDFS、Hive 查询结果"),
    ("bigdata:run", "提交大数据任务", "提交或取消 Spark / Hive 任务"),
    ("ml:predict", "运行 ML 推理", "调用 ML 模型进行健康风险预测"),
]


def upgrade() -> None:
    # ---- Tables ----
    op.create_table(
        "bigdata_jobs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("job_id", sa.String(length=64), nullable=False, unique=True),
        sa.Column("job_type", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("params", sa.JSON(), nullable=True),
        sa.Column("log_path", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("submitted_by", sa.BigInteger(), nullable=True),
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
    op.create_index("ix_bigdata_jobs_status", "bigdata_jobs", ["status"])

    op.create_table(
        "prediction_results",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("elder_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "high_risk_prob",
            sa.Numeric(precision=6, scale=4),
            nullable=False,
            server_default="0",
        ),
        sa.Column("high_risk", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "followup_prob",
            sa.Numeric(precision=6, scale=4),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "followup_needed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("health_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("predicted_at", sa.DateTime(), nullable=False),
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
    op.create_index(
        "ix_prediction_results_elder_id", "prediction_results", ["elder_id"]
    )
    op.create_index(
        "ix_prediction_results_predicted_at",
        "prediction_results",
        ["predicted_at"],
    )

    # ---- Permissions ----
    for code, name, desc in NEW_PERMISSIONS:
        op.execute(
            sa.text(
                "INSERT IGNORE INTO permissions (code, name, description) "
                "VALUES (:code, :name, :desc)"
            ).bindparams(code=code, name=name, desc=desc)
        )

    # Grant bigdata:read, bigdata:run, ml:predict to admin; ml:predict to doctor.
    op.execute(
        """
        INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
          FROM roles r
          JOIN permissions p
            ON (r.name = 'admin'  AND p.code IN ('bigdata:read','bigdata:run','ml:predict'))
            OR (r.name = 'doctor' AND p.code = 'ml:predict')
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE rp FROM role_permissions rp
          JOIN permissions p ON rp.permission_id = p.id
         WHERE p.code IN ('bigdata:read','bigdata:run','ml:predict')
        """
    )
    op.execute(
        "DELETE FROM permissions "
        "WHERE code IN ('bigdata:read','bigdata:run','ml:predict')"
    )

    op.drop_index("ix_prediction_results_predicted_at", table_name="prediction_results")
    op.drop_index("ix_prediction_results_elder_id", table_name="prediction_results")
    op.drop_table("prediction_results")

    op.drop_index("ix_bigdata_jobs_status", table_name="bigdata_jobs")
    op.drop_table("bigdata_jobs")
