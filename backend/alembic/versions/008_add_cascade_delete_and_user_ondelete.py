"""Add cascade delete relationships and user ondelete handlers.

Revision ID: 008
Revises: 007
Create Date: 2024-01-01 00:00:00.000000

This migration documents the following schema changes:
1. Farm.labour, Farm.labour_ledger_lines, etc now cascade-delete their children
2. FarmLabour.ledger_lines now cascade-delete on parent deletion
3. FlockEvent.created_by_user_id now SET NULL on user deletion (was non-nullable)
4. LabourLedgerLine.created_by_user_id now SET NULL on user deletion (was non-nullable)
5. AuditLog.farm_id now SET NULL on farm deletion (was relying on relationship)

Note: These changes are ORM-level relationship configurations and may not require
direct database migration if the FK constraints haven't been altered. The database
already supports these behaviors through the existing FK definitions.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Update FlockEvent.created_by_user_id to allow NULL with ondelete=SET NULL
    op.alter_column(
        'flock_events',
        'created_by_user_id',
        existing_type=sa.Integer(),
        nullable=True,
        existing_nullable=False,
    )
    # Drop old FK if it exists, add new one with ondelete=SET NULL
    op.drop_constraint('flock_events_created_by_user_id_fkey', 'flock_events', type_='foreignkey')
    op.create_foreign_key(
        'flock_events_created_by_user_id_fkey',
        'flock_events',
        'users',
        ['created_by_user_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Update LabourLedgerLine.created_by_user_id to allow NULL with ondelete=SET NULL
    op.alter_column(
        'labour_ledger_lines',
        'created_by_user_id',
        existing_type=sa.Integer(),
        nullable=True,
        existing_nullable=False,
    )
    # Drop old FK if it exists, add new one with ondelete=SET NULL
    op.drop_constraint('labour_ledger_lines_created_by_user_id_fkey', 'labour_ledger_lines', type_='foreignkey')
    op.create_foreign_key(
        'labour_ledger_lines_created_by_user_id_fkey',
        'labour_ledger_lines',
        'users',
        ['created_by_user_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Update AuditLog.farm_id FK to use ondelete=SET NULL
    op.drop_constraint('audit_logs_farm_id_fkey', 'audit_logs', type_='foreignkey')
    op.create_foreign_key(
        'audit_logs_farm_id_fkey',
        'audit_logs',
        'farms',
        ['farm_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # Revert AuditLog FK
    op.drop_constraint('audit_logs_farm_id_fkey', 'audit_logs', type_='foreignkey')
    op.create_foreign_key(
        'audit_logs_farm_id_fkey',
        'audit_logs',
        'farms',
        ['farm_id'],
        ['id'],
    )

    # Revert LabourLedgerLine FK and nullability
    op.drop_constraint('labour_ledger_lines_created_by_user_id_fkey', 'labour_ledger_lines', type_='foreignkey')
    op.create_foreign_key(
        'labour_ledger_lines_created_by_user_id_fkey',
        'labour_ledger_lines',
        'users',
        ['created_by_user_id'],
        ['id'],
    )
    op.alter_column(
        'labour_ledger_lines',
        'created_by_user_id',
        existing_type=sa.Integer(),
        nullable=False,
        existing_nullable=True,
    )

    # Revert FlockEvent FK and nullability
    op.drop_constraint('flock_events_created_by_user_id_fkey', 'flock_events', type_='foreignkey')
    op.create_foreign_key(
        'flock_events_created_by_user_id_fkey',
        'flock_events',
        'users',
        ['created_by_user_id'],
        ['id'],
    )
    op.alter_column(
        'flock_events',
        'created_by_user_id',
        existing_type=sa.Integer(),
        nullable=False,
        existing_nullable=True,
    )
