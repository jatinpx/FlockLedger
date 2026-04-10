"""Expense links to labour/feed; feed purchase cost for P&L

Revision ID: 005
Revises: 004
Create Date: 2026-04-08

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "feed_inventory",
        sa.Column("purchase_cost_inr", sa.Numeric(14, 2), nullable=True),
    )
    op.add_column(
        "expenses",
        sa.Column("labour_ledger_line_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "expenses",
        sa.Column("feed_inventory_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_expenses_labour_ledger_line_id",
        "expenses",
        "labour_ledger_lines",
        ["labour_ledger_line_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_expenses_feed_inventory_id",
        "expenses",
        "feed_inventory",
        ["feed_inventory_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "uq_expenses_labour_ledger_line_id",
        "expenses",
        ["labour_ledger_line_id"],
        unique=True,
    )
    op.create_index(
        "uq_expenses_feed_inventory_id",
        "expenses",
        ["feed_inventory_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_expenses_feed_inventory_id", table_name="expenses")
    op.drop_index("uq_expenses_labour_ledger_line_id", table_name="expenses")
    op.drop_constraint("fk_expenses_feed_inventory_id", "expenses", type_="foreignkey")
    op.drop_constraint("fk_expenses_labour_ledger_line_id", "expenses", type_="foreignkey")
    op.drop_column("expenses", "feed_inventory_id")
    op.drop_column("expenses", "labour_ledger_line_id")
    op.drop_column("feed_inventory", "purchase_cost_inr")
