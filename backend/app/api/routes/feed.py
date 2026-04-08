from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.farm_access import require_farm_member, require_farm_role
from app.api.pagination import LimitOffset, pagination_params
from app.database import get_db
from app.deps import ClientIp, CurrentUser
from app.models import FeedInventory
from app.schemas.pagination import Paginated
from app.schemas.production import FeedInventoryCreate, FeedInventoryOut, FeedInventoryUpdate
from app.services.audit_service import record_audit
from app.services.redis_events import publish_farm_event

router = APIRouter(prefix="/farms/{farm_id}/feed", tags=["feed"])

MANAGER_ROLES = ("owner", "manager")
WORKER_OK = ("owner", "manager", "worker")


def _to_out(r: FeedInventory) -> FeedInventoryOut:
    return FeedInventoryOut(
        id=r.id,
        farm_id=r.farm_id,
        date=r.date,
        feed_received=float(r.feed_received),
        feed_used=float(r.feed_used),
        feed_remaining=float(r.feed_remaining),
        created_at=r.created_at,
    )


def _row_dict(r: FeedInventory) -> dict:
    return {
        "date": str(r.date),
        "feed_received": float(r.feed_received),
        "feed_used": float(r.feed_used),
        "feed_remaining": float(r.feed_remaining),
    }


@router.post("", response_model=FeedInventoryOut)
def create_feed_entry(
    farm_id: int,
    body: FeedInventoryCreate,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *WORKER_OK)
    row = FeedInventory(
        farm_id=farm_id,
        date=body.date,
        feed_received=Decimal(str(body.feed_received)),
        feed_used=Decimal(str(body.feed_used)),
        feed_remaining=Decimal(str(body.feed_remaining)),
    )
    db.add(row)
    db.flush()
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
    require_farm_role(db, user.id, farm_id, *WORKER_OK)
    row = (
        db.query(FeedInventory)
        .filter(FeedInventory.id == record_id, FeedInventory.farm_id == farm_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    before = _row_dict(row)
    data = body.model_dump(exclude_unset=True)
    if "date" in data:
        row.date = data["date"]
    if "feed_received" in data:
        row.feed_received = Decimal(str(data["feed_received"]))
    if "feed_used" in data:
        row.feed_used = Decimal(str(data["feed_used"]))
    if "feed_remaining" in data:
        row.feed_remaining = Decimal(str(data["feed_remaining"]))
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
):
    require_farm_member(db, user.id, farm_id)
    q = (
        db.query(FeedInventory)
        .filter(FeedInventory.farm_id == farm_id)
        .order_by(FeedInventory.date.desc(), FeedInventory.id.desc())
    )
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
