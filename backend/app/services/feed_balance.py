"""Closing feed stock chain: auto-compute remaining from prior closing + received - used."""

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import FeedInventory


def _prior_closing_before_day(db: Session, farm_id: int, entry_date) -> Decimal:
    prev = (
        db.query(FeedInventory)
        .filter(
            FeedInventory.farm_id == farm_id,
            FeedInventory.date < entry_date,
        )
        .order_by(FeedInventory.date.desc(), FeedInventory.id.desc())
        .first()
    )
    return prev.feed_remaining if prev else Decimal("0")


def _latest_same_day_closing(db: Session, farm_id: int, entry_date) -> Decimal | None:
    same = (
        db.query(FeedInventory)
        .filter(
            FeedInventory.farm_id == farm_id,
            FeedInventory.date == entry_date,
        )
        .order_by(FeedInventory.id.desc())
        .first()
    )
    return same.feed_remaining if same else None


def assert_no_later_feed_date(db: Session, farm_id: int, entry_date) -> None:
    later = (
        db.query(FeedInventory)
        .filter(
            FeedInventory.farm_id == farm_id,
            FeedInventory.date > entry_date,
        )
        .first()
    )
    if later:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add a feed row on an earlier date than existing entries. "
            "Remove or adjust later-dated rows first, or adjust the latest entry for physical count.",
        )


def opening_balance_kg(db: Session, farm_id: int, entry_date) -> Decimal:
    assert_no_later_feed_date(db, farm_id, entry_date)
    same = _latest_same_day_closing(db, farm_id, entry_date)
    if same is not None:
        return same
    return _prior_closing_before_day(db, farm_id, entry_date)


def opening_for_existing_row(row: FeedInventory) -> Decimal:
    """Reconstruct opening at time this row was saved: closing - received + used."""
    return row.feed_remaining - row.feed_received + row.feed_used


def compute_remaining_kg(opening: Decimal, received: Decimal, used: Decimal) -> Decimal:
    return opening + received - used


def validate_non_negative_remaining(value: Decimal) -> None:
    if value < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Computed feed remaining would be negative (opening + received < used). "
            "Reduce feed_used or increase feed_received / check opening stock.",
        )
