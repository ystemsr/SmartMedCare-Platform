"""add feature_inputs + prediction_result_id to assessments

Stores the full 20-feature snapshot used to drive the ML assessment so later
audits can reproduce the prediction, and links the assessment to the
prediction_results row it produced so the elder list's `latest_*` fields
stay in sync automatically.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-04-23
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql


revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "assessments",
        sa.Column("feature_inputs", mysql.JSON(), nullable=True),
    )
    op.add_column(
        "assessments",
        sa.Column(
            "prediction_result_id",
            mysql.BIGINT(unsigned=True),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_assessments_prediction_result_id",
        "assessments",
        ["prediction_result_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_assessments_prediction_result_id", table_name="assessments")
    op.drop_column("assessments", "prediction_result_id")
    op.drop_column("assessments", "feature_inputs")
