from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.analytics_params import list_optional_date_range
from app.api.farm_access import require_farm_role
from app.api.pagination import LimitOffset, pagination_params
from app.database import get_db
from app.deps import ClientIp, CurrentUser
from app.models import Sale
from app.schemas.pagination import Paginated
from app.schemas.sales import SaleCreate, SaleOut, SaleUpdate, _money2
from app.services.audit_service import record_audit
from app.services.production_service import EGGS_PER_TRAY
from app.services.redis_events import publish_farm_event

router = APIRouter(prefix="/farms/{farm_id}/sales", tags=["sales"])

MANAGER_ROLES = ("owner", "manager")


def _to_out(s: Sale) -> SaleOut:
    rt = float(s.rate_per_tray)
    return SaleOut(
        id=s.id,
        farm_id=s.farm_id,
        buyer_name=s.buyer_name,
        trays_sold=s.trays_sold,
        rate_per_tray=rt,
        rate_per_egg=rt / float(EGGS_PER_TRAY),
        total_amount=float(s.total_amount),
        date=s.date,
        created_at=s.created_at,
    )


def _row_dict(s: Sale) -> dict:
    return {
        "buyer_name": s.buyer_name,
        "trays_sold": s.trays_sold,
        "rate_per_tray": float(s.rate_per_tray),
        "total_amount": float(s.total_amount),
        "date": str(s.date),
    }


@router.post("", response_model=SaleOut)
def create_sale(
    farm_id: int,
    body: SaleCreate,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    expected = Decimal(str(body.trays_sold)) * Decimal(str(body.rate_per_tray))
    if abs(expected - Decimal(str(body.total_amount))) > Decimal("0.02"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="total_amount should equal trays_sold * rate_per_tray",
        )
    row = Sale(
        farm_id=farm_id,
        buyer_name=body.buyer_name,
        trays_sold=body.trays_sold,
        rate_per_tray=Decimal(str(body.rate_per_tray)),
        total_amount=Decimal(str(body.total_amount)),
        date=body.date,
    )
    db.add(row)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="create",
        resource_type="sale",
        resource_id=row.id,
        before=None,
        after=_row_dict(row),
        ip=ip,
    )
    db.commit()
    db.refresh(row)
    publish_farm_event(farm_id, "sale_created", {"id": row.id})
    return _to_out(row)


@router.patch("/{sale_id}", response_model=SaleOut)
def patch_sale(
    farm_id: int,
    sale_id: int,
    body: SaleUpdate,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    row = db.query(Sale).filter(Sale.id == sale_id, Sale.farm_id == farm_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    before = _row_dict(row)
    data = body.model_dump(exclude_unset=True)
    re_raw = data.pop("rate_per_egg", None)

    if "buyer_name" in data:
        row.buyer_name = data["buyer_name"]
    if "trays_sold" in data:
        row.trays_sold = data["trays_sold"]
    if re_raw is not None:
        egg = Decimal(str(re_raw))
        tray_from_egg = _money2(egg * Decimal(EGGS_PER_TRAY))
        if "rate_per_tray" in data:
            rt_new = Decimal(str(data["rate_per_tray"]))
            if abs(rt_new - tray_from_egg) > Decimal("0.02"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"rate_per_tray must equal rate_per_egg × {EGGS_PER_TRAY}",
                )
            row.rate_per_tray = rt_new
        else:
            row.rate_per_tray = tray_from_egg
    elif "rate_per_tray" in data:
        row.rate_per_tray = Decimal(str(data["rate_per_tray"]))
    if "total_amount" in data:
        row.total_amount = Decimal(str(data["total_amount"]))
    if "date" in data:
        row.date = data["date"]
    expected = row.trays_sold * row.rate_per_tray
    if abs(expected - row.total_amount) > Decimal("0.02"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="total_amount should equal trays_sold * rate_per_tray",
        )
    after = _row_dict(row)
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="update",
        resource_type="sale",
        resource_id=sale_id,
        before=before,
        after=after,
        ip=ip,
    )
    db.commit()
    db.refresh(row)
    publish_farm_event(farm_id, "sale_updated", {"id": sale_id})
    return _to_out(row)


@router.get("", response_model=Paginated[SaleOut])
def list_sales(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
    dr: tuple = Depends(list_optional_date_range),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    start_date, end_date = dr
    q = db.query(Sale).filter(Sale.farm_id == farm_id)
    if start_date is not None:
        q = q.filter(Sale.date >= start_date)
    if end_date is not None:
        q = q.filter(Sale.date <= end_date)
    q = q.order_by(Sale.date.desc(), Sale.id.desc())
    total = q.count()
    rows = q.offset(page.offset).limit(page.limit).all()
    items = [_to_out(r) for r in rows]
    return Paginated(items=items, total=total, limit=page.limit, offset=page.offset)


@router.delete("/{sale_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sale(
    farm_id: int,
    sale_id: int,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    row = db.query(Sale).filter(Sale.id == sale_id, Sale.farm_id == farm_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    before = _row_dict(row)
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="delete",
        resource_type="sale",
        resource_id=sale_id,
        before=before,
        after=None,
        ip=ip,
    )
    db.delete(row)
    db.commit()
    publish_farm_event(farm_id, "sale_deleted", {"id": sale_id})
