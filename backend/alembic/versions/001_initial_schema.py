"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-04-08

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "farms",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("location", sa.String(length=512), nullable=True),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_farms_owner_id"), "farms", ["owner_id"], unique=False)

    op.create_table(
        "farm_members",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("farm_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "farm_id", name="uq_farm_member_user_farm"),
    )
    op.create_index(op.f("ix_farm_members_farm_id"), "farm_members", ["farm_id"], unique=False)
    op.create_index(op.f("ix_farm_members_user_id"), "farm_members", ["user_id"], unique=False)

    op.create_table(
        "sheds",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("farm_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("bird_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sheds_farm_id"), "sheds", ["farm_id"], unique=False)

    op.create_table(
        "egg_production",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("shed_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("eggs_produced", sa.Integer(), nullable=False),
        sa.Column("broken_eggs", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["shed_id"], ["sheds.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("shed_id", "date", name="uq_egg_production_shed_date"),
    )
    op.create_index(op.f("ix_egg_production_date"), "egg_production", ["date"], unique=False)
    op.create_index(op.f("ix_egg_production_shed_id"), "egg_production", ["shed_id"], unique=False)

    op.create_table(
        "feed_inventory",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("farm_id", sa.Integer(), nullable=False),
        sa.Column("feed_received", sa.Numeric(12, 2), nullable=False),
        sa.Column("feed_used", sa.Numeric(12, 2), nullable=False),
        sa.Column("feed_remaining", sa.Numeric(12, 2), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_feed_inventory_date"), "feed_inventory", ["date"], unique=False)
    op.create_index(op.f("ix_feed_inventory_farm_id"), "feed_inventory", ["farm_id"], unique=False)

    op.create_table(
        "sales",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("farm_id", sa.Integer(), nullable=False),
        sa.Column("buyer_name", sa.String(length=255), nullable=False),
        sa.Column("trays_sold", sa.Integer(), nullable=False),
        sa.Column("rate_per_tray", sa.Numeric(12, 2), nullable=False),
        sa.Column("total_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sales_date"), "sales", ["date"], unique=False)
    op.create_index(op.f("ix_sales_farm_id"), "sales", ["farm_id"], unique=False)

    op.create_table(
        "expenses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("farm_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=128), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_expenses_date"), "expenses", ["date"], unique=False)
    op.create_index(op.f("ix_expenses_farm_id"), "expenses", ["farm_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_expenses_farm_id"), table_name="expenses")
    op.drop_index(op.f("ix_expenses_date"), table_name="expenses")
    op.drop_table("expenses")
    op.drop_index(op.f("ix_sales_farm_id"), table_name="sales")
    op.drop_index(op.f("ix_sales_date"), table_name="sales")
    op.drop_table("sales")
    op.drop_index(op.f("ix_feed_inventory_farm_id"), table_name="feed_inventory")
    op.drop_index(op.f("ix_feed_inventory_date"), table_name="feed_inventory")
    op.drop_table("feed_inventory")
    op.drop_index(op.f("ix_egg_production_shed_id"), table_name="egg_production")
    op.drop_index(op.f("ix_egg_production_date"), table_name="egg_production")
    op.drop_table("egg_production")
    op.drop_index(op.f("ix_sheds_farm_id"), table_name="sheds")
    op.drop_table("sheds")
    op.drop_index(op.f("ix_farm_members_user_id"), table_name="farm_members")
    op.drop_index(op.f("ix_farm_members_farm_id"), table_name="farm_members")
    op.drop_table("farm_members")
    op.drop_index(op.f("ix_farms_owner_id"), table_name="farms")
    op.drop_table("farms")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
