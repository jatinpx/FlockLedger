"""backfill feed purchase costs into expenses

Revision ID: 007
Revises: 006
Create Date: 2026-04-09
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO expenses (farm_id, category, amount, description, date, feed_inventory_id)
        SELECT
            f.farm_id,
            'Feed & fodder',
            f.purchase_cost_inr,
            ('Feed purchase cost — ' || CAST(f.date AS TEXT)),
            f.date,
            f.id
        FROM feed_inventory f
        LEFT JOIN expenses e
            ON e.feed_inventory_id = f.id
        WHERE f.purchase_cost_inr IS NOT NULL
          AND e.id IS NULL
        """
    )


def downgrade() -> None:
    pass
