"""migrate_admin_to_owner

Revision ID: 95948970fab0
Revises: b407fd8a7da0
Create Date: 2026-01-15 23:48:47.123456

"""

from typing import Sequence, Union

from alembic import op  # type: ignore


# revision identifiers, used by Alembic.
revision: str = "95948970fab0"
down_revision: Union[str, Sequence[str], None] = "b407fd8a7da0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Migrate 'admin' role to 'owner'."""
    # Data migration
    op.execute("UPDATE workspace_members SET role = 'owner' WHERE role::text = 'admin'")


def downgrade() -> None:
    """Rollback 'owner' role to 'admin'."""
    op.execute("UPDATE workspace_members SET role = 'admin' WHERE role::text = 'owner'")
