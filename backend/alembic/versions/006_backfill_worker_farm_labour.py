"""Backfill FarmLabour for existing farm members with role worker.

Revision ID: 006
Revises: 005
Create Date: 2026-04-08

"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy.orm import Session

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    session = Session(bind=bind)
    try:
        from app.services.labour_provision import backfill_worker_labour_rows

        backfill_worker_labour_rows(session)
        session.commit()
    finally:
        session.close()


def downgrade() -> None:
    pass
