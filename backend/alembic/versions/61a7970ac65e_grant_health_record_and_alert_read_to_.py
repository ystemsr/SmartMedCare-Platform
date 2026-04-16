"""grant health_record and alert read to elder and family roles

Revision ID: 61a7970ac65e
Revises:
Create Date: 2026-04-16
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "61a7970ac65e"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES "
        "(3, 7), (3, 10), (4, 7), (4, 10)"
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM role_permissions "
        "WHERE (role_id, permission_id) IN ((3, 7), (3, 10), (4, 7), (4, 10))"
    )
