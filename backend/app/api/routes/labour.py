from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.analytics_params import list_optional_date_range
from app.api.farm_access import require_farm_member, require_farm_role
from app.api.pagination import LimitOffset, pagination_params
from app.database import get_db
from app.deps import ClientIp, CurrentUser
from app.constants.expense_categories import LABOUR_WAGES_CATEGORY
from app.models import Expense, FarmLabour, FarmMember, LabourLedgerLine
from app.schemas.labour import (
    FarmLabourCreate,
    FarmLabourOut,
    FarmLabourPatch,
    LabourBalanceRow,
    LabourLedgerCreate,
    LabourLedgerOut,
    PayrollAccrueBody,
    PayrollListOut,
    PayrollPayoutBody,
    PayrollWorkerOut,
)
from app.schemas.pagination import Paginated
from app.services.audit_service import record_audit
from app.services.labour_balance import ledger_balance
from app.services.payroll_service import (
    accrual_description,
    accrual_line_date,
    current_month_str,
    find_payroll_accrual_line,
    month_bounds,
    sum_ledger_in_month,
    validate_month_str,
)
from app.services.redis_events import publish_farm_event

router = APIRouter(prefix="/farms/{farm_id}/labour", tags=["labour"])

MANAGER_ROLES = ("owner", "manager")


def _ensure_linked_user_valid(
    db: Session,
    farm_id: int,
    linked_user_id: int | None,
    *,
    exclude_labour_id: int | None = None,
) -> None:
    if linked_user_id is None:
        return
    mem = (
        db.query(FarmMember)
        .filter(FarmMember.farm_id == farm_id, FarmMember.user_id == linked_user_id)
        .first()
    )
    if not mem or mem.role != "worker":
        raise HTTPException(
            status_code=400,
            detail="linked_user_id must be a worker member of this farm",
        )
    q = db.query(FarmLabour).filter(
        FarmLabour.farm_id == farm_id,
        FarmLabour.linked_user_id == linked_user_id,
    )
    if exclude_labour_id is not None:
        q = q.filter(FarmLabour.id != exclude_labour_id)
    if q.first():
        raise HTTPException(
            status_code=400,
            detail="This user is already linked to another labour record on this farm",
        )


def _resolve_labour_for_payroll(
    db: Session,
    farm_id: int,
    labour_id: int | None,
    user_id: int | None,
) -> FarmLabour:
    if labour_id is not None:
        row = (
            db.query(FarmLabour)
            .filter(FarmLabour.id == labour_id, FarmLabour.farm_id == farm_id)
            .first()
        )
    else:
        row = (
            db.query(FarmLabour)
            .filter(FarmLabour.farm_id == farm_id, FarmLabour.linked_user_id == user_id)
            .first()
        )
    if not row:
        raise HTTPException(status_code=404, detail="Labour not found")
    return row


def _linked_expense_id(db: Session, farm_id: int, line_id: int) -> int | None:
    eid = (
        db.query(Expense.id)
        .filter(
            Expense.farm_id == farm_id,
            Expense.labour_ledger_line_id == line_id,
        )
        .scalar()
    )
    return int(eid) if eid is not None else None


def _line_to_ledger_out(db: Session, farm_id: int, line: LabourLedgerLine) -> LabourLedgerOut:
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
        linked_expense_id=_linked_expense_id(db, farm_id, line.id),
    )


def _add_labour_payment_line(
    db: Session,
    farm_id: int,
    labour: FarmLabour,
    *,
    amount: Decimal,
    line_date: date,
    description: str | None,
    acting_user_id: int,
    ip: str | None,
    force: bool = False,
) -> LabourLedgerLine:
    if not labour.is_active and not force:
        raise HTTPException(
            status_code=400,
            detail="Labour is inactive; reactivate or pass force=true to post adjustments.",
        )
    line = LabourLedgerLine(
        farm_id=farm_id,
        labour_id=labour.id,
        line_date=line_date,
        line_type="payment",
        amount=amount,
        description=description,
        created_by_user_id=acting_user_id,
    )
    db.add(line)
    db.flush()
    record_audit(
        db,
        user_id=acting_user_id,
        farm_id=farm_id,
        action="create",
        resource_type="labour_ledger_line",
        resource_id=line.id,
        before=None,
        after={
            "labour_id": labour.id,
            "line_type": "payment",
            "amount": str(amount),
        },
        ip=ip,
    )
    exp = Expense(
        farm_id=farm_id,
        category=LABOUR_WAGES_CATEGORY,
        amount=line.amount,
        description=description or f"Wage payment — {labour.full_name}",
        date=line_date,
        labour_ledger_line_id=line.id,
    )
    db.add(exp)
    db.flush()
    record_audit(
        db,
        user_id=acting_user_id,
        farm_id=farm_id,
        action="create",
        resource_type="expense",
        resource_id=exp.id,
        before=None,
        after={
            "category": exp.category,
            "amount": float(exp.amount),
            "labour_ledger_line_id": line.id,
        },
        ip=ip,
    )
    publish_farm_event(farm_id, "expense_created", {"id": exp.id})
    return line


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
        linked_user_id=row.linked_user_id,
        created_at=row.created_at,
    )


@router.get("/summary", response_model=list[LabourBalanceRow])
def labour_summary(farm_id: int, user: CurrentUser, db: Session = Depends(get_db)):
    m = require_farm_member(db, user.id, farm_id)
    q = db.query(FarmLabour).filter(FarmLabour.farm_id == farm_id)
    if m.role == "worker":
        q = q.filter(FarmLabour.linked_user_id == user.id)
    rows = q.order_by(FarmLabour.personnel_kind.asc(), FarmLabour.full_name.asc()).all()
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


@router.get("/me", response_model=FarmLabourOut | None)
def get_my_labour_row(farm_id: int, user: CurrentUser, db: Session = Depends(get_db)):
    require_farm_member(db, user.id, farm_id)
    row = (
        db.query(FarmLabour)
        .filter(
            FarmLabour.farm_id == farm_id,
            FarmLabour.linked_user_id == user.id,
        )
        .first()
    )
    if not row:
        return None
    return _labour_to_out(db, row)


@router.get(
    "/payroll",
    response_model=PayrollListOut,
    summary="Month-scoped payroll snapshot",
    description=(
        "Per labour row: monthly salary (default_rate), running balance_due, and sums of "
        "ledger earnings/payments whose line_date falls in the selected calendar month. "
        "Payroll accrual lines use description `Payroll accrual YYYY-MM` and are dated the "
        "last day of that month."
    ),
)
def get_payroll(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    month: str | None = Query(
        None,
        pattern=r"^\d{4}-\d{2}$",
        description="YYYY-MM; defaults to current calendar month (server date)",
    ),
):
    m = require_farm_member(db, user.id, farm_id)
    ym = month or current_month_str()
    try:
        validate_month_str(ym)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month; use YYYY-MM")
    start, end = month_bounds(ym)
    q = db.query(FarmLabour).filter(FarmLabour.farm_id == farm_id)
    if m.role == "worker":
        q = q.filter(FarmLabour.linked_user_id == user.id)
    rows = q.order_by(FarmLabour.is_active.desc(), FarmLabour.full_name.asc()).all()
    workers: list[PayrollWorkerOut] = []
    for r in rows:
        acc = sum_ledger_in_month(db, r.id, start, end, "earning")
        paid = sum_ledger_in_month(db, r.id, start, end, "payment")
        pl = find_payroll_accrual_line(db, r.id, ym)
        workers.append(
            PayrollWorkerOut(
                labour_id=r.id,
                full_name=r.full_name,
                linked_user_id=r.linked_user_id,
                personnel_kind=r.personnel_kind,
                is_active=r.is_active,
                monthly_salary=float(r.default_rate) if r.default_rate is not None else None,
                balance_due=float(ledger_balance(db, r.id)),
                month=ym,
                month_accrued=float(acc),
                month_paid=float(paid),
                month_net=float(acc - paid),
                payroll_accrual_posted=pl is not None,
                payroll_accrual_amount=float(pl.amount) if pl is not None else None,
            )
        )
    return PayrollListOut(month=ym, workers=workers)


@router.post("/payroll/accrue", response_model=LabourLedgerOut)
def payroll_accrue(
    farm_id: int,
    body: PayrollAccrueBody,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
    force: bool = Query(
        False,
        description="Allow accrual posting for inactive labour (owner cleanup)",
    ),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    try:
        validate_month_str(body.month)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month; use YYYY-MM")
    labour = _resolve_labour_for_payroll(db, farm_id, body.labour_id, body.user_id)
    if not labour.is_active and not force:
        raise HTTPException(
            status_code=400,
            detail="Labour is inactive; reactivate or pass force=true to post adjustments.",
        )
    amt_dec: Decimal
    if body.amount is not None:
        amt_dec = Decimal(str(body.amount))
    elif labour.default_rate is not None:
        amt_dec = labour.default_rate
    else:
        raise HTTPException(
            status_code=400,
            detail="amount is required when labour has no monthly salary (default_rate) set",
        )
    if amt_dec <= 0:
        raise HTTPException(status_code=400, detail="amount must be positive")

    accrual_desc = accrual_description(body.month)
    line_date = accrual_line_date(body.month)
    existing = find_payroll_accrual_line(db, labour.id, body.month)
    if existing:
        before_amt = str(existing.amount)
        existing.amount = amt_dec
        existing.line_date = line_date
        existing.description = accrual_desc
        db.flush()
        record_audit(
            db,
            user_id=user.id,
            farm_id=farm_id,
            action="update",
            resource_type="labour_ledger_line",
            resource_id=existing.id,
            before={"amount": before_amt},
            after={"amount": str(amt_dec), "payroll_accrual_month": body.month},
            ip=ip,
        )
        db.commit()
        db.refresh(existing)
        publish_farm_event(farm_id, "labour_ledger", {"labour_id": labour.id, "id": existing.id})
        return _line_to_ledger_out(db, farm_id, existing)

    line = LabourLedgerLine(
        farm_id=farm_id,
        labour_id=labour.id,
        line_date=line_date,
        line_type="earning",
        amount=amt_dec,
        description=accrual_desc,
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
            "labour_id": labour.id,
            "line_type": "earning",
            "amount": str(amt_dec),
            "payroll_accrual_month": body.month,
        },
        ip=ip,
    )
    db.commit()
    db.refresh(line)
    publish_farm_event(farm_id, "labour_ledger", {"labour_id": labour.id, "id": line.id})
    return _line_to_ledger_out(db, farm_id, line)


@router.post("/payroll/payout", response_model=LabourLedgerOut)
def payroll_payout(
    farm_id: int,
    body: PayrollPayoutBody,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
    force: bool = Query(
        False,
        description="Allow payout for inactive labour (owner cleanup)",
    ),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    try:
        validate_month_str(body.month)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month; use YYYY-MM")
    start, end = month_bounds(body.month)
    if body.line_date < start or body.line_date > end:
        raise HTTPException(
            status_code=400,
            detail="line_date must fall within the selected payroll month (calendar attribution)",
        )
    labour = _resolve_labour_for_payroll(db, farm_id, body.labour_id, body.user_id)
    amt = body.amount
    line = _add_labour_payment_line(
        db,
        farm_id,
        labour,
        amount=amt,
        line_date=body.line_date,
        description=body.description,
        acting_user_id=user.id,
        ip=ip,
        force=force,
    )
    db.commit()
    db.refresh(line)
    publish_farm_event(farm_id, "labour_ledger", {"labour_id": labour.id, "id": line.id})
    return _line_to_ledger_out(db, farm_id, line)


@router.get("", response_model=Paginated[FarmLabourOut])
def list_labour(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
    active_only: bool = Query(
        False,
        description="If true, only workers/lines with is_active=true (e.g. expense wage picker).",
    ),
):
    m = require_farm_member(db, user.id, farm_id)
    q = db.query(FarmLabour).filter(FarmLabour.farm_id == farm_id)
    if m.role == "worker":
        q = q.filter(FarmLabour.linked_user_id == user.id)
    if active_only:
        q = q.filter(FarmLabour.is_active == True)
    q = q.order_by(FarmLabour.is_active.desc(), FarmLabour.full_name.asc())
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
    _ensure_linked_user_valid(db, farm_id, body.linked_user_id)
    row = FarmLabour(
        farm_id=farm_id,
        full_name=body.full_name.strip(),
        phone=body.phone.strip() if body.phone else None,
        personnel_kind=body.personnel_kind,
        compensation_type=body.compensation_type,
        default_rate=Decimal(str(body.default_rate)) if body.default_rate is not None else None,
        notes=body.notes,
        hired_at=body.hired_at,
        linked_user_id=body.linked_user_id,
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
    if "linked_user_id" in data:
        _ensure_linked_user_valid(
            db, farm_id, data["linked_user_id"], exclude_labour_id=labour_id
        )
        row.linked_user_id = data["linked_user_id"]
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
    if body.line_type == "payment":
        line = _add_labour_payment_line(
            db,
            farm_id,
            labour,
            amount=body.amount,
            line_date=body.line_date,
            description=body.description,
            acting_user_id=user.id,
            ip=ip,
            force=force,
        )
    else:
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
    return _line_to_ledger_out(db, farm_id, line)


@router.get("/{labour_id}/ledger", response_model=Paginated[LabourLedgerOut])
def list_ledger(
    farm_id: int,
    labour_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
    dr: tuple = Depends(list_optional_date_range),
):
    m = require_farm_member(db, user.id, farm_id)
    exists = (
        db.query(FarmLabour)
        .filter(FarmLabour.id == labour_id, FarmLabour.farm_id == farm_id)
        .first()
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Labour not found")
    if m.role == "worker" and exists.linked_user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own pay and ledger",
        )
    start_date, end_date = dr
    q = db.query(LabourLedgerLine).filter(
        LabourLedgerLine.labour_id == labour_id,
        LabourLedgerLine.farm_id == farm_id,
    )
    if start_date is not None:
        q = q.filter(LabourLedgerLine.line_date >= start_date)
    if end_date is not None:
        q = q.filter(LabourLedgerLine.line_date <= end_date)
    q = q.order_by(LabourLedgerLine.line_date.desc(), LabourLedgerLine.id.desc())
    total = q.count()
    rows = q.offset(page.offset).limit(page.limit).all()
    line_ids = [r.id for r in rows]
    exp_map: dict[int, int] = {}
    if line_ids:
        for lid, eid in (
            db.query(Expense.labour_ledger_line_id, Expense.id)
            .filter(
                Expense.farm_id == farm_id,
                Expense.labour_ledger_line_id.in_(line_ids),
            )
            .all()
        ):
            if lid is not None:
                exp_map[int(lid)] = int(eid)
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
            linked_expense_id=exp_map.get(r.id),
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
    linked_exp = (
        db.query(Expense)
        .filter(
            Expense.labour_ledger_line_id == line_id,
            Expense.farm_id == farm_id,
        )
        .first()
    )
    if linked_exp:
        record_audit(
            db,
            user_id=user.id,
            farm_id=farm_id,
            action="delete",
            resource_type="expense",
            resource_id=linked_exp.id,
            before={
                "category": linked_exp.category,
                "amount": float(linked_exp.amount),
                "labour_ledger_line_id": line_id,
            },
            after=None,
            ip=ip,
        )
        db.delete(linked_exp)
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
