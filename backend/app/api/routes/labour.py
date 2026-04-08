from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.farm_access import require_farm_member, require_farm_role
from app.api.pagination import LimitOffset, pagination_params
from app.database import get_db
from app.deps import ClientIp, CurrentUser
from app.models import FarmLabour, LabourLedgerLine
from app.schemas.labour import (
    FarmLabourCreate,
    FarmLabourOut,
    FarmLabourPatch,
    LabourBalanceRow,
    LabourLedgerCreate,
    LabourLedgerOut,
)
from app.schemas.pagination import Paginated
from app.services.audit_service import record_audit
from app.services.labour_balance import ledger_balance
from app.services.redis_events import publish_farm_event

router = APIRouter(prefix="/farms/{farm_id}/labour", tags=["labour"])

MANAGER_ROLES = ("owner", "manager")


def _labour_to_out(db: Session, row: FarmLabour) -> FarmLabourOut:
    return FarmLabourOut(
        id=row.id,
        farm_id=row.farm_id,
        full_name=row.full_name,
        phone=row.phone,
        personnel_kind=row.personnel_kind,
        compensation_type=row.compensation_type,
        default_rate=float(row.default_rate) if row.default_rate is not None else None,
        notes=row.notes,
        is_active=row.is_active,
        hired_at=row.hired_at,
        balance_due=float(ledger_balance(db, row.id)),
        created_at=row.created_at,
    )


@router.get("/summary", response_model=list[LabourBalanceRow])
def labour_summary(farm_id: int, user: CurrentUser, db: Session = Depends(get_db)):
    require_farm_member(db, user.id, farm_id)
    rows = (
        db.query(FarmLabour)
        .filter(FarmLabour.farm_id == farm_id)
        .order_by(FarmLabour.personnel_kind.asc(), FarmLabour.full_name.asc())
        .all()
    )
    return [
        LabourBalanceRow(
            labour_id=r.id,
            full_name=r.full_name,
            personnel_kind=r.personnel_kind,
            is_active=r.is_active,
            balance=float(ledger_balance(db, r.id)),
        )
        for r in rows
    ]


@router.get("", response_model=Paginated[FarmLabourOut])
def list_labour(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
):
    require_farm_member(db, user.id, farm_id)
    q = (
        db.query(FarmLabour)
        .filter(FarmLabour.farm_id == farm_id)
        .order_by(FarmLabour.is_active.desc(), FarmLabour.full_name.asc())
    )
    total = q.count()
    rows = q.offset(page.offset).limit(page.limit).all()
    items = [_labour_to_out(db, r) for r in rows]
    return Paginated(items=items, total=total, limit=page.limit, offset=page.offset)


@router.post("", response_model=FarmLabourOut)
def create_labour(
    farm_id: int,
    body: FarmLabourCreate,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    row = FarmLabour(
        farm_id=farm_id,
        full_name=body.full_name.strip(),
        phone=body.phone.strip() if body.phone else None,
        personnel_kind=body.personnel_kind,
        compensation_type=body.compensation_type,
        default_rate=Decimal(str(body.default_rate)) if body.default_rate is not None else None,
        notes=body.notes,
        hired_at=body.hired_at,
        is_active=True,
    )
    db.add(row)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="create",
        resource_type="farm_labour",
        resource_id=row.id,
        before=None,
        after={"full_name": row.full_name, "personnel_kind": row.personnel_kind},
        ip=ip,
    )
    db.commit()
    db.refresh(row)
    publish_farm_event(farm_id, "labour_created", {"id": row.id})
    return _labour_to_out(db, row)


@router.patch("/{labour_id}", response_model=FarmLabourOut)
def patch_labour(
    farm_id: int,
    labour_id: int,
    body: FarmLabourPatch,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    row = (
        db.query(FarmLabour)
        .filter(FarmLabour.id == labour_id, FarmLabour.farm_id == farm_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    before = {"full_name": row.full_name, "is_active": row.is_active}
    data = body.model_dump(exclude_unset=True)
    if "full_name" in data and data["full_name"] is not None:
        row.full_name = data["full_name"].strip()
    if "phone" in data:
        row.phone = data["phone"].strip() if data["phone"] else None
    if "personnel_kind" in data and data["personnel_kind"] is not None:
        row.personnel_kind = data["personnel_kind"]
    if "compensation_type" in data and data["compensation_type"] is not None:
        row.compensation_type = data["compensation_type"]
    if "default_rate" in data:
        row.default_rate = (
            Decimal(str(data["default_rate"])) if data["default_rate"] is not None else None
        )
    if "notes" in data:
        row.notes = data["notes"]
    if "is_active" in data and data["is_active"] is not None:
        row.is_active = data["is_active"]
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="update",
        resource_type="farm_labour",
        resource_id=labour_id,
        before=before,
        after={"full_name": row.full_name, "is_active": row.is_active},
        ip=ip,
    )
    db.commit()
    db.refresh(row)
    return _labour_to_out(db, row)


@router.post("/{labour_id}/ledger", response_model=LabourLedgerOut)
def add_ledger_line(
    farm_id: int,
    labour_id: int,
    body: LabourLedgerCreate,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
    force: bool = Query(False, description="Allow posting for inactive labour (owner cleanup)"),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    labour = (
        db.query(FarmLabour)
        .filter(FarmLabour.id == labour_id, FarmLabour.farm_id == farm_id)
        .first()
    )
    if not labour:
        raise HTTPException(status_code=404, detail="Labour not found")
    if not labour.is_active and not force:
        raise HTTPException(
            status_code=400,
            detail="Labour is inactive; reactivate or pass force=true to post adjustments.",
        )
    line = LabourLedgerLine(
        farm_id=farm_id,
        labour_id=labour_id,
        line_date=body.line_date,
        line_type=body.line_type,
        amount=body.amount,
        description=body.description,
        created_by_user_id=user.id,
    )
    db.add(line)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="create",
        resource_type="labour_ledger_line",
        resource_id=line.id,
        before=None,
        after={
            "labour_id": labour_id,
            "line_type": body.line_type,
            "amount": str(body.amount),
        },
        ip=ip,
    )
    db.commit()
    db.refresh(line)
    publish_farm_event(farm_id, "labour_ledger", {"labour_id": labour_id, "id": line.id})
    return LabourLedgerOut(
        id=line.id,
        farm_id=line.farm_id,
        labour_id=line.labour_id,
        line_date=line.line_date,
        line_type=line.line_type,
        amount=float(line.amount),
        description=line.description,
        created_by_user_id=line.created_by_user_id,
        created_at=line.created_at,
    )


@router.get("/{labour_id}/ledger", response_model=Paginated[LabourLedgerOut])
def list_ledger(
    farm_id: int,
    labour_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
):
    require_farm_member(db, user.id, farm_id)
    exists = (
        db.query(FarmLabour)
        .filter(FarmLabour.id == labour_id, FarmLabour.farm_id == farm_id)
        .first()
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Labour not found")
    q = (
        db.query(LabourLedgerLine)
        .filter(
            LabourLedgerLine.labour_id == labour_id,
            LabourLedgerLine.farm_id == farm_id,
        )
        .order_by(LabourLedgerLine.line_date.desc(), LabourLedgerLine.id.desc())
    )
    total = q.count()
    rows = q.offset(page.offset).limit(page.limit).all()
    items = [
        LabourLedgerOut(
            id=r.id,
            farm_id=r.farm_id,
            labour_id=r.labour_id,
            line_date=r.line_date,
            line_type=r.line_type,
            amount=float(r.amount),
            description=r.description,
            created_by_user_id=r.created_by_user_id,
            created_at=r.created_at,
        )
        for r in rows
    ]
    return Paginated(items=items, total=total, limit=page.limit, offset=page.offset)


@router.delete("/{labour_id}/ledger/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ledger_line(
    farm_id: int,
    labour_id: int,
    line_id: int,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    """Manager-only reversal of mistaken ledger rows."""
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    line = (
        db.query(LabourLedgerLine)
        .filter(
            LabourLedgerLine.id == line_id,
            LabourLedgerLine.labour_id == labour_id,
            LabourLedgerLine.farm_id == farm_id,
        )
        .first()
    )
    if not line:
        raise HTTPException(status_code=404, detail="Not found")
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="delete",
        resource_type="labour_ledger_line",
        resource_id=line_id,
        before={"line_type": line.line_type, "amount": str(line.amount)},
        after=None,
        ip=ip,
    )
    db.delete(line)
    db.commit()
