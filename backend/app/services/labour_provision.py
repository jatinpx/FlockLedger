"""Auto-link FarmLabour rows to farm members with role worker (single roster identity)."""

import datetime as dt

from sqlalchemy.orm import Session

from app.models import FarmLabour, FarmMember, User


def ensure_farm_labour_for_worker(db: Session, farm_id: int, user_id: int) -> FarmLabour | None:
    """If the user is a worker on this farm, ensure exactly one active FarmLabour row exists."""
    mem = (
        db.query(FarmMember)
        .filter(FarmMember.farm_id == farm_id, FarmMember.user_id == user_id)
        .first()
    )
    if not mem or mem.role != "worker":
        return None

    existing = (
        db.query(FarmLabour)
        .filter(FarmLabour.farm_id == farm_id, FarmLabour.linked_user_id == user_id)
        .first()
    )
    if existing:
        if not existing.is_active:
            existing.is_active = True
        return existing

    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        return None

    row = FarmLabour(
        farm_id=farm_id,
        full_name=u.name,
        phone=None,
        linked_user_id=user_id,
        personnel_kind="labour",
        compensation_type="monthly",
        default_rate=None,
        notes=None,
        is_active=True,
        hired_at=dt.date.today(),
    )
    db.add(row)
    db.flush()
    return row


def deactivate_farm_labour_for_non_worker(db: Session, farm_id: int, user_id: int) -> None:
    """When a member is no longer a worker, deactivate their linked labour row (ledger preserved)."""
    row = (
        db.query(FarmLabour)
        .filter(FarmLabour.farm_id == farm_id, FarmLabour.linked_user_id == user_id)
        .first()
    )
    if row:
        row.is_active = False


def backfill_worker_labour_rows(db: Session) -> int:
    """Create missing FarmLabour rows for all farm members with role worker. Returns rows created."""
    created = 0
    workers = db.query(FarmMember).filter(FarmMember.role == "worker").all()
    for mem in workers:
        existed = (
            db.query(FarmLabour)
            .filter(
                FarmLabour.farm_id == mem.farm_id,
                FarmLabour.linked_user_id == mem.user_id,
            )
            .first()
        )
        ensure_farm_labour_for_worker(db, mem.farm_id, mem.user_id)
        if existed is None:
            row = (
                db.query(FarmLabour)
                .filter(
                    FarmLabour.farm_id == mem.farm_id,
                    FarmLabour.linked_user_id == mem.user_id,
                )
                .first()
            )
            if row is not None:
                created += 1
    return created
