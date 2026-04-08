from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.farm_access import get_shed_for_farm, require_farm_member, require_farm_role
from app.api.pagination import LimitOffset, pagination_params
from app.database import get_db
from app.deps import ClientIp, CurrentUser
from app.models import FlockEvent, Shed
from app.schemas.flock import FlockEventCreate, FlockEventOut, FlockSummary
from app.schemas.pagination import Paginated
from app.services.audit_service import record_audit
from app.services import analytics_service as asvc
from app.services.flock_service import (
    apply_flock_event_to_shed,
    birds_delta_for_kind,
    event_row_delta,
    flock_kind_totals,
)
from app.services.redis_events import publish_farm_event

router = APIRouter(prefix="/farms/{farm_id}/flock", tags=["flock"])

MANAGER_ROLES = ("owner", "manager")
WORKER_OK = ("owner", "manager", "worker")


def _to_out(row: FlockEvent) -> FlockEventOut:
    delta = event_row_delta(row)
    q = row.quantity if row.event_kind == "count_adjust" else abs(row.quantity)
    return FlockEventOut(
        id=row.id,
        farm_id=row.farm_id,
        shed_id=row.shed_id,
        event_date=row.event_date,
        event_kind=row.event_kind,
        quantity=q,
        birds_delta=delta,
        note=row.note,
        created_by_user_id=row.created_by_user_id,
        created_at=row.created_at,
    )


@router.get("/summary", response_model=FlockSummary)
def flock_summary(farm_id: int, user: CurrentUser, db: Session = Depends(get_db)):
    require_farm_member(db, user.id, farm_id)
    sheds = db.query(Shed).filter(Shed.farm_id == farm_id).order_by(Shed.name.asc()).all()
    by_kind = flock_kind_totals(db, farm_id)
    return FlockSummary(
        birds_alive_total=asvc.farm_total_birds(db, farm_id),
        by_kind=by_kind,
        by_shed=[{"shed_id": s.id, "name": s.name, "bird_count": s.bird_count} for s in sheds],
    )


@router.post("/events", response_model=FlockEventOut)
def create_flock_event(
    farm_id: int,
    body: FlockEventCreate,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *WORKER_OK)
    shed = get_shed_for_farm(db, body.shed_id, farm_id)
    store_qty = body.quantity if body.event_kind == "count_adjust" else abs(body.quantity)
    try:
        delta = birds_delta_for_kind(
            body.event_kind,
            body.quantity if body.event_kind == "count_adjust" else store_qty,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    try:
        apply_flock_event_to_shed(db, shed, delta)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    row = FlockEvent(
        farm_id=farm_id,
        shed_id=body.shed_id,
        event_date=body.event_date,
        event_kind=body.event_kind,
        quantity=store_qty,
        note=body.note,
        created_by_user_id=user.id,
    )
    db.add(row)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="create",
        resource_type="flock_event",
        resource_id=row.id,
        before=None,
        after={
            "kind": body.event_kind,
            "quantity": store_qty,
            "shed_id": body.shed_id,
            "delta": delta,
        },
        ip=ip,
    )
    db.commit()
    db.refresh(row)
    publish_farm_event(farm_id, "flock_event", {"id": row.id, "kind": body.event_kind})
    return _to_out(row)


@router.get("/events", response_model=Paginated[FlockEventOut])
def list_flock_events(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
):
    require_farm_member(db, user.id, farm_id)
    q = (
        db.query(FlockEvent)
        .filter(FlockEvent.farm_id == farm_id)
        .order_by(FlockEvent.event_date.desc(), FlockEvent.id.desc())
    )
    total = q.count()
    rows = q.offset(page.offset).limit(page.limit).all()
    items = [_to_out(r) for r in rows]
    return Paginated(items=items, total=total, limit=page.limit, offset=page.offset)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flock_event(
    farm_id: int,
    event_id: int,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    row = (
        db.query(FlockEvent)
        .filter(FlockEvent.id == event_id, FlockEvent.farm_id == farm_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    shed = get_shed_for_farm(db, row.shed_id, farm_id)
    delta = event_row_delta(row)
    try:
        apply_flock_event_to_shed(db, shed, -delta)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reverse event: {e}",
        ) from e
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="delete",
        resource_type="flock_event",
        resource_id=event_id,
        before={"kind": row.event_kind, "delta": delta},
        after=None,
        ip=ip,
    )
    db.delete(row)
    db.commit()
