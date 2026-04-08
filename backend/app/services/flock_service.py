from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import FlockEvent, Shed

OUT_KINDS = frozenset({"mortality", "cull", "live_sale", "transfer_out"})
IN_KINDS = frozenset({"purchase", "transfer_in"})


def birds_delta_for_kind(kind: str, quantity: int) -> int:
    if kind == "count_adjust":
        if quantity == 0:
            raise ValueError("count_adjust quantity cannot be zero")
        return quantity
    if kind in OUT_KINDS:
        if quantity <= 0:
            raise ValueError("quantity must be positive for this event kind")
        return -quantity
    if kind in IN_KINDS:
        if quantity <= 0:
            raise ValueError("quantity must be positive for this event kind")
        return quantity
    raise ValueError(f"unknown event_kind: {kind}")


def apply_flock_event_to_shed(db: Session, shed: Shed, delta: int) -> None:
    new_count = shed.bird_count + delta
    if new_count < 0:
        raise ValueError("bird count cannot go negative; reduce quantity or adjust sheds")
    shed.bird_count = new_count


def flock_kind_totals(db: Session, farm_id: int) -> dict[str, int]:
    rows = (
        db.query(FlockEvent.event_kind, func.coalesce(func.sum(FlockEvent.quantity), 0))
        .filter(FlockEvent.farm_id == farm_id)
        .group_by(FlockEvent.event_kind)
        .all()
    )
    return {k: int(v or 0) for k, v in rows}


def flock_kind_totals_range(
    db: Session, farm_id: int, start: date, end: date
) -> dict[str, int]:
    """Quantity sums by event_kind for events with event_date in [start, end] inclusive."""
    rows = (
        db.query(FlockEvent.event_kind, func.coalesce(func.sum(FlockEvent.quantity), 0))
        .filter(
            FlockEvent.farm_id == farm_id,
            FlockEvent.event_date >= start,
            FlockEvent.event_date <= end,
        )
        .group_by(FlockEvent.event_kind)
        .all()
    )
    return {k: int(v or 0) for k, v in rows}


def event_row_delta(row: FlockEvent) -> int:
    if row.event_kind == "count_adjust":
        return birds_delta_for_kind("count_adjust", row.quantity)
    return birds_delta_for_kind(row.event_kind, abs(row.quantity))
