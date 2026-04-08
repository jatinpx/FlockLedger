"""labour flock tables

Revision ID: 003
Revises: 002
Create Date: 2026-04-08

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "farm_labour",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("farm_id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=64), nullable=True),
        sa.Column("personnel_kind", sa.String(length=32), nullable=False, server_default="labour"),
        sa.Column("compensation_type", sa.String(length=32), nullable=False, server_default="monthly"),
        sa.Column("default_rate", sa.Numeric(12, 2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("hired_at", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_farm_labour_farm_id"), "farm_labour", ["farm_id"], unique=False)

    op.create_table(
        "labour_ledger_lines",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("farm_id", sa.Integer(), nullable=False),
        sa.Column("labour_id", sa.Integer(), nullable=False),
        sa.Column("line_date", sa.Date(), nullable=False),
        sa.Column("line_type", sa.String(length=32), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("description", sa.String(length=512), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"]),
        sa.ForeignKeyConstraint(["labour_id"], ["farm_labour.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_labour_ledger_lines_farm_id"), "labour_ledger_lines", ["farm_id"], unique=False)
    op.create_index(op.f("ix_labour_ledger_lines_labour_id"), "labour_ledger_lines", ["labour_id"], unique=False)
    op.create_index(op.f("ix_labour_ledger_lines_line_date"), "labour_ledger_lines", ["line_date"], unique=False)

    op.create_table(
        "flock_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("farm_id", sa.Integer(), nullable=False),
        sa.Column("shed_id", sa.Integer(), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("event_kind", sa.String(length=32), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"]),
        sa.ForeignKeyConstraint(["shed_id"], ["sheds.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_flock_events_farm_id"), "flock_events", ["farm_id"], unique=False)
    op.create_index(op.f("ix_flock_events_shed_id"), "flock_events", ["shed_id"], unique=False)
    op.create_index(op.f("ix_flock_events_event_date"), "flock_events", ["event_date"], unique=False)

    op.add_column(
        "feed_inventory",
        sa.Column(
            "remaining_manual",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("feed_inventory", "remaining_manual")
    op.drop_index(op.f("ix_flock_events_event_date"), table_name="flock_events")
    op.drop_index(op.f("ix_flock_events_shed_id"), table_name="flock_events")
    op.drop_index(op.f("ix_flock_events_farm_id"), table_name="flock_events")
    op.drop_table("flock_events")
    op.drop_index(op.f("ix_labour_ledger_lines_line_date"), table_name="labour_ledger_lines")
    op.drop_index(op.f("ix_labour_ledger_lines_labour_id"), table_name="labour_ledger_lines")
    op.drop_index(op.f("ix_labour_ledger_lines_farm_id"), table_name="labour_ledger_lines")
    op.drop_table("labour_ledger_lines")
    op.drop_index(op.f("ix_farm_labour_farm_id"), table_name="farm_labour")
    op.drop_table("farm_labour")
