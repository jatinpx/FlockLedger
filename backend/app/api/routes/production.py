from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.farm_access import get_shed_for_farm, require_farm_member, require_farm_role
from app.api.pagination import LimitOffset, pagination_params
from app.database import get_db
from app.deps import ClientIp, CurrentUser
from app.models import EggProduction, Shed
from app.schemas.pagination import Paginated
from app.schemas.production import (
    EggProductionCreate,
    EggProductionOut,
    EggProductionPatch,
)
from app.services.audit_service import record_audit
from app.services.production_service import trays_from_eggs, usable_eggs
from app.services.redis_events import publish_farm_event

router = APIRouter(prefix="/farms/{farm_id}/production", tags=["production"])

WORKER_OK = ("owner", "manager", "worker")


def _to_out(row: EggProduction) -> EggProductionOut:
    u = usable_eggs(row.eggs_produced, row.broken_eggs)
    return EggProductionOut(
        id=row.id,
        shed_id=row.shed_id,
        date=row.date,
        eggs_produced=row.eggs_produced,
        broken_eggs=row.broken_eggs,
        usable_eggs=u,
        trays=trays_from_eggs(u),
        created_at=row.created_at,
    )


def _egg_dict(row: EggProduction) -> dict:
    return {
        "shed_id": row.shed_id,
        "date": str(row.date),
        "eggs_produced": row.eggs_produced,
        "broken_eggs": row.broken_eggs,
    }


@router.post("/eggs", response_model=EggProductionOut)
def create_egg_production(
    farm_id: int,
    body: EggProductionCreate,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *WORKER_OK)
    get_shed_for_farm(db, body.shed_id, farm_id)
    existing = (
        db.query(EggProduction)
        .filter(EggProduction.shed_id == body.shed_id, EggProduction.date == body.date)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Production for this shed and date already exists; use PUT/PATCH to update",
        )
    row = EggProduction(
        shed_id=body.shed_id,
        date=body.date,
        eggs_produced=body.eggs_produced,
        broken_eggs=body.broken_eggs,
    )
    db.add(row)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="create",
        resource_type="egg_production",
        resource_id=row.id,
        before=None,
        after=_egg_dict(row),
        ip=ip,
    )
    db.commit()
    db.refresh(row)
    publish_farm_event(
        farm_id,
        "egg_production_created",
        {"shed_id": body.shed_id, "date": str(body.date), "id": row.id},
    )
    return _to_out(row)


@router.put("/eggs/{record_id}", response_model=EggProductionOut)
def upsert_egg_production(
    farm_id: int,
    record_id: int,
    body: EggProductionCreate,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *WORKER_OK)
    get_shed_for_farm(db, body.shed_id, farm_id)
    row = (
        db.query(EggProduction)
        .join(Shed, Shed.id == EggProduction.shed_id)
        .filter(
            EggProduction.id == record_id,
            Shed.farm_id == farm_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    before = _egg_dict(row)
    row.shed_id = body.shed_id
    row.date = body.date
    row.eggs_produced = body.eggs_produced
    row.broken_eggs = body.broken_eggs
    if row.broken_eggs > row.eggs_produced:
        raise HTTPException(status_code=400, detail="broken_eggs cannot exceed eggs_produced")
    after = _egg_dict(row)
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="update",
        resource_type="egg_production",
        resource_id=record_id,
        before=before,
        after=after,
        ip=ip,
    )
    db.commit()
    db.refresh(row)
    publish_farm_event(farm_id, "egg_production_updated", {"id": row.id})
    return _to_out(row)


@router.patch("/eggs/{record_id}", response_model=EggProductionOut)
def patch_egg_production(
    farm_id: int,
    record_id: int,
    body: EggProductionPatch,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *WORKER_OK)
    row = (
        db.query(EggProduction)
        .join(Shed, Shed.id == EggProduction.shed_id)
        .filter(
            EggProduction.id == record_id,
            Shed.farm_id == farm_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    before = _egg_dict(row)
    data = body.model_dump(exclude_unset=True)
    if "shed_id" in data:
        get_shed_for_farm(db, data["shed_id"], farm_id)
        row.shed_id = data["shed_id"]
    if "date" in data:
        row.date = data["date"]
    if "eggs_produced" in data:
        row.eggs_produced = data["eggs_produced"]
    if "broken_eggs" in data:
        row.broken_eggs = data["broken_eggs"]
    if row.broken_eggs > row.eggs_produced:
        raise HTTPException(status_code=400, detail="broken_eggs cannot exceed eggs_produced")
    clash = (
        db.query(EggProduction)
        .filter(
            EggProduction.shed_id == row.shed_id,
            EggProduction.date == row.date,
            EggProduction.id != record_id,
        )
        .first()
    )
    if clash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another record exists for this shed and date",
        )
    after = _egg_dict(row)
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="update",
        resource_type="egg_production",
        resource_id=record_id,
        before=before,
        after=after,
        ip=ip,
    )
    db.commit()
    db.refresh(row)
    publish_farm_event(farm_id, "egg_production_updated", {"id": row.id})
    return _to_out(row)


@router.get("/eggs", response_model=Paginated[EggProductionOut])
def list_egg_production(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
):
    require_farm_member(db, user.id, farm_id)
    q = (
        db.query(EggProduction)
        .join(Shed, Shed.id == EggProduction.shed_id)
        .filter(Shed.farm_id == farm_id)
        .order_by(EggProduction.date.desc(), EggProduction.id.desc())
    )
    total = q.count()
    rows = q.offset(page.offset).limit(page.limit).all()
    items = [_to_out(r) for r in rows]
    return Paginated(items=items, total=total, limit=page.limit, offset=page.offset)
