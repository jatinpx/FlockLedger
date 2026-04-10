from datetime import date as dt_date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.analytics_params import list_optional_date_range
from app.api.farm_access import require_farm_role
from app.api.pagination import LimitOffset, pagination_params
from app.constants.expense_categories import FEED_FODDER_CATEGORY
from app.database import get_db
from app.deps import ClientIp, CurrentUser
from app.models import Expense, FeedInventory
from app.schemas.pagination import Paginated
from app.schemas.production import FeedInventoryCreate, FeedInventoryOut, FeedInventoryUpdate
from app.services.audit_service import record_audit
from app.services.feed_balance import (
    assert_no_later_feed_date,
    compute_remaining_kg,
    opening_balance_kg,
    opening_for_existing_row,
    validate_non_negative_remaining,
)
from app.services.redis_events import publish_farm_event

router = APIRouter(prefix="/farms/{farm_id}/feed", tags=["feed"])

MANAGER_ROLES = ("owner", "manager")


def _to_out(r: FeedInventory) -> FeedInventoryOut:
    opening = opening_for_existing_row(r)
    pc = float(r.purchase_cost_inr) if r.purchase_cost_inr is not None else None
    return FeedInventoryOut(
        id=r.id,
        farm_id=r.farm_id,
        date=r.date,
        feed_received=float(r.feed_received),
        feed_used=float(r.feed_used),
        feed_remaining=float(r.feed_remaining),
        purchase_cost_inr=pc,
        opening_balance_kg=float(opening),
        remaining_auto=not r.remaining_manual,
        created_at=r.created_at,
    )


def _row_dict(r: FeedInventory) -> dict:
    return {
        "date": str(r.date),
        "feed_received": float(r.feed_received),
        "feed_used": float(r.feed_used),
        "feed_remaining": float(r.feed_remaining),
        "remaining_manual": r.remaining_manual,
        "purchase_cost_inr": float(r.purchase_cost_inr) if r.purchase_cost_inr is not None else None,
    }


def _expense_row_dict(e: Expense) -> dict:
    return {
        "category": e.category,
        "amount": float(e.amount),
        "description": e.description,
        "date": str(e.date),
        "labour_ledger_line_id": e.labour_ledger_line_id,
        "feed_inventory_id": e.feed_inventory_id,
    }


def _sync_feed_purchase_expense(
    db: Session,
    *,
    farm_id: int,
    feed_row: FeedInventory,
    acting_user_id: int,
    ip: str | None,
) -> None:
    linked = (
        db.query(Expense)
        .filter(
            Expense.farm_id == farm_id,
            Expense.feed_inventory_id == feed_row.id,
        )
        .first()
    )

    if feed_row.purchase_cost_inr is None:
        if linked is None:
            return
        before = _expense_row_dict(linked)
        record_audit(
            db,
            user_id=acting_user_id,
            farm_id=farm_id,
            action="delete",
            resource_type="expense",
            resource_id=linked.id,
            before=before,
            after=None,
            ip=ip,
        )
        deleted_id = linked.id
        db.delete(linked)
        publish_farm_event(farm_id, "expense_deleted", {"id": deleted_id})
        return

    amount = Decimal(str(feed_row.purchase_cost_inr))
    description = f"Feed purchase cost — {feed_row.date.isoformat()}"

    if linked is None:
        row = Expense(
            farm_id=farm_id,
            category=FEED_FODDER_CATEGORY,
            amount=amount,
            description=description,
            date=feed_row.date,
            feed_inventory_id=feed_row.id,
        )
        db.add(row)
        db.flush()
        record_audit(
            db,
            user_id=acting_user_id,
            farm_id=farm_id,
            action="create",
            resource_type="expense",
            resource_id=row.id,
            before=None,
            after=_expense_row_dict(row),
            ip=ip,
        )
        publish_farm_event(farm_id, "expense_created", {"id": row.id})
        return

    before = _expense_row_dict(linked)
    linked.category = FEED_FODDER_CATEGORY
    linked.amount = amount
    linked.description = description
    linked.date = feed_row.date
    after = _expense_row_dict(linked)
    record_audit(
        db,
        user_id=acting_user_id,
        farm_id=farm_id,
        action="update",
        resource_type="expense",
        resource_id=linked.id,
        before=before,
        after=after,
        ip=ip,
    )
    publish_farm_event(farm_id, "expense_updated", {"id": linked.id})


@router.get("/preview-opening")
def preview_feed_opening(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    date: dt_date = Query(..., description="ISO date for the new row"),
):
    """Opening kg for a new row on this date (same rules as create)."""
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    assert_no_later_feed_date(db, farm_id, date)
    opening = opening_balance_kg(db, farm_id, date)
    return {"opening_balance_kg": float(opening), "date": str(date)}


@router.post("", response_model=FeedInventoryOut)
def create_feed_entry(
    farm_id: int,
    body: FeedInventoryCreate,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    opening = opening_balance_kg(db, farm_id, body.date)
    recv = Decimal(str(body.feed_received))
    used = Decimal(str(body.feed_used))
    if body.feed_remaining is not None:
        rem = Decimal(str(body.feed_remaining))
        manual = True
    else:
        rem = compute_remaining_kg(opening, recv, used)
        manual = False
    validate_non_negative_remaining(rem)
    pc: Decimal | None = None
    if body.purchase_cost_inr is not None:
        pc = Decimal(str(body.purchase_cost_inr))
    row = FeedInventory(
        farm_id=farm_id,
        date=body.date,
        feed_received=recv,
        feed_used=used,
        feed_remaining=rem,
        remaining_manual=manual,
        purchase_cost_inr=pc,
    )
    db.add(row)
    db.flush()
    _sync_feed_purchase_expense(
        db,
        farm_id=farm_id,
        feed_row=row,
        acting_user_id=user.id,
        ip=ip,
    )
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="create",
        resource_type="feed_inventory",
        resource_id=row.id,
        before=None,
        after=_row_dict(row),
        ip=ip,
    )
    db.commit()
    db.refresh(row)
    publish_farm_event(farm_id, "feed_entry_created", {"id": row.id, "date": str(body.date)})
    return _to_out(row)


@router.patch("/{record_id}", response_model=FeedInventoryOut)
def patch_feed_entry(
    farm_id: int,
    record_id: int,
    body: FeedInventoryUpdate,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    row = (
        db.query(FeedInventory)
        .filter(FeedInventory.id == record_id, FeedInventory.farm_id == farm_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    before = _row_dict(row)
    data = body.model_dump(exclude_unset=True)
    if "date" in data and data["date"] != row.date:
        raise HTTPException(
            status_code=400,
            detail="Changing feed row date is not supported; delete and recreate if needed.",
        )

    opening_at_row = opening_for_existing_row(row)

    if "feed_received" in data:
        row.feed_received = Decimal(str(data["feed_received"]))
    if "feed_used" in data:
        row.feed_used = Decimal(str(data["feed_used"]))

    if "feed_remaining" in data and data["feed_remaining"] is not None:
        row.feed_remaining = Decimal(str(data["feed_remaining"]))
        row.remaining_manual = True
    elif "feed_received" in data or "feed_used" in data:
        row.feed_remaining = compute_remaining_kg(opening_at_row, row.feed_received, row.feed_used)
        row.remaining_manual = False
        validate_non_negative_remaining(row.feed_remaining)

    if "purchase_cost_inr" in data:
        if data["purchase_cost_inr"] is not None:
            row.purchase_cost_inr = Decimal(str(data["purchase_cost_inr"]))
        else:
            row.purchase_cost_inr = None

    if (
        "purchase_cost_inr" in data
        or "date" in data
        or "feed_received" in data
        or "feed_used" in data
        or "feed_remaining" in data
    ):
        _sync_feed_purchase_expense(
            db,
            farm_id=farm_id,
            feed_row=row,
            acting_user_id=user.id,
            ip=ip,
        )

    after = _row_dict(row)
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="update",
        resource_type="feed_inventory",
        resource_id=record_id,
        before=before,
        after=after,
        ip=ip,
    )
    db.commit()
    db.refresh(row)
    publish_farm_event(farm_id, "feed_entry_updated", {"id": record_id})
    return _to_out(row)


@router.get("", response_model=Paginated[FeedInventoryOut])
def list_feed(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
    dr: tuple = Depends(list_optional_date_range),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    start_date, end_date = dr
    q = db.query(FeedInventory).filter(FeedInventory.farm_id == farm_id)
    if start_date is not None:
        q = q.filter(FeedInventory.date >= start_date)
    if end_date is not None:
        q = q.filter(FeedInventory.date <= end_date)
    q = q.order_by(FeedInventory.date.desc(), FeedInventory.id.desc())
    total = q.count()
    rows = q.offset(page.offset).limit(page.limit).all()
    items = [_to_out(r) for r in rows]
    return Paginated(items=items, total=total, limit=page.limit, offset=page.offset)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feed(
    farm_id: int,
    record_id: int,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    row = (
        db.query(FeedInventory)
        .filter(FeedInventory.id == record_id, FeedInventory.farm_id == farm_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    linked_expense = (
        db.query(Expense)
        .filter(Expense.farm_id == farm_id, Expense.feed_inventory_id == record_id)
        .first()
    )
    if linked_expense:
        exp_before = _expense_row_dict(linked_expense)
        record_audit(
            db,
            user_id=user.id,
            farm_id=farm_id,
            action="delete",
            resource_type="expense",
            resource_id=linked_expense.id,
            before=exp_before,
            after=None,
            ip=ip,
        )
        linked_id = linked_expense.id
        db.delete(linked_expense)
        publish_farm_event(farm_id, "expense_deleted", {"id": linked_id})
    before = _row_dict(row)
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="delete",
        resource_type="feed_inventory",
        resource_id=record_id,
        before=before,
        after=None,
        ip=ip,
    )
    db.delete(row)
    db.commit()
    publish_farm_event(farm_id, "feed_entry_deleted", {"id": record_id})
