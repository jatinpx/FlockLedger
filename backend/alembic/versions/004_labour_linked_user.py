"""farm_labour linked_user_id for worker self-service

Revision ID: 004
Revises: 003
Create Date: 2026-04-08

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "farm_labour",
        sa.Column("linked_user_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f("ix_farm_labour_linked_user_id"),
        "farm_labour",
        ["linked_user_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_farm_labour_linked_user_id_users",
        "farm_labour",
        "users",
        ["linked_user_id"],
        ["id"],
    )
    op.create_unique_constraint(
        "uq_farm_labour_farm_linked_user",
        "farm_labour",
        ["farm_id", "linked_user_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_farm_labour_farm_linked_user", "farm_labour", type_="unique")
    op.drop_constraint("fk_farm_labour_linked_user_id_users", "farm_labour", type_="foreignkey")
    op.drop_index(op.f("ix_farm_labour_linked_user_id"), table_name="farm_labour")
    op.drop_column("farm_labour", "linked_user_id")
