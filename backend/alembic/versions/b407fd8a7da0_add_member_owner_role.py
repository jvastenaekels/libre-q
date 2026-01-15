"""add_member_owner_role

Revision ID: b407fd8a7da0
Revises:
Create Date: 2026-01-15 23:47:05.283708

"""

from typing import Sequence, Union

from alembic import op  # type: ignore


# revision identifiers, used by Alembic.
revision: str = "b407fd8a7da0"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add 'owner' value to workspacerole enum."""
    # Note: ALTER TYPE ... ADD VALUE cannot be executed in a transaction block
    # in some PostgreSQL versions. Alembic's op.execute normally runs in a transaction.
    # However, for ADD VALUE, we can use the following approach if needed.
    # But since we are targeting modern PostgreSQL, ADD VALUE IF NOT EXISTS is preferred.

    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        # Using a raw execute because op.execute might be wrapped in a transaction
        # and PostgreSQL doesn't allow ALTER TYPE ... ADD VALUE in a transaction
        # unless it was created in the same transaction.
        # IF NOT EXISTS requires PG 10+
        op.execute("COMMIT")  # Break out of Alembic's transaction
        op.execute("ALTER TYPE workspacerole ADD VALUE IF NOT EXISTS 'owner'")
    else:
        # User said no SQLite, so we don't handle it here as a primary concern,
        # but we keep it safe.
        pass


def downgrade() -> None:
    """Downgrade is not supported for enum additions in PostgreSQL without recreating the type."""
    pass
