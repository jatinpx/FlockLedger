from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.analytics_params import list_optional_date_range
from app.api.farm_access import require_farm_role
from app.api.pagination import LimitOffset, pagination_params
from app.database import get_db
from app.deps import ClientIp, CurrentUser
from app.constants.expense_categories import (
    FEED_FODDER_CATEGORY,
    LABOUR_WAGES_CATEGORY,
    misc_requires_description,
)
from app.models import Expense, FarmLabour, FeedInventory, LabourLedgerLine
from app.schemas.expenses import ExpenseCreate, ExpenseOut, ExpenseUpdate
from app.schemas.pagination import Paginated
from app.services.audit_service import record_audit
from app.services.redis_events import publish_farm_event

router = APIRouter(prefix="/farms/{farm_id}/expenses", tags=["expenses"])

MANAGER_ROLES = ("owner", "manager")


def _labour_names_for_line_ids(
    db: Session, farm_id: int, line_ids: list[int]
) -> dict[int, tuple[int, str]]:
    if not line_ids:
        return {}
    rows = (
        db.query(LabourLedgerLine.id, LabourLedgerLine.labour_id, FarmLabour.full_name)
        .join(FarmLabour, FarmLabour.id == LabourLedgerLine.labour_id)
        .filter(
            LabourLedgerLine.farm_id == farm_id,
            LabourLedgerLine.id.in_(line_ids),
        )
        .all()
    )
    return {int(rid): (int(lab_id), str(name)) for rid, lab_id, name in rows}


def _to_out(db: Session, farm_id: int, e: Expense) -> ExpenseOut:
    lid: int | None = None
    lname: str | None = None
    if e.labour_ledger_line_id is not None:
        m = _labour_names_for_line_ids(db, farm_id, [e.labour_ledger_line_id])
        t = m.get(e.labour_ledger_line_id)
        if t:
            lid, lname = t
    return ExpenseOut(
        id=e.id,
        farm_id=e.farm_id,
        category=e.category,
        amount=float(e.amount),
        description=e.description,
        date=e.date,
        created_at=e.created_at,
        labour_ledger_line_id=e.labour_ledger_line_id,
        feed_inventory_id=e.feed_inventory_id,
        linked_labour_id=lid,
        linked_labour_name=lname,
    )


def _to_out_many(db: Session, farm_id: int, rows: list[Expense]) -> list[ExpenseOut]:
    line_ids = [int(x) for x in (e.labour_ledger_line_id for e in rows) if x is not None]
    line_ids = list(dict.fromkeys(line_ids))
    m = _labour_names_for_line_ids(db, farm_id, line_ids)
    out: list[ExpenseOut] = []
    for e in rows:
        lid: int | None = None
        lname: str | None = None
        if e.labour_ledger_line_id is not None:
            t = m.get(e.labour_ledger_line_id)
            if t:
                lid, lname = t
        out.append(
            ExpenseOut(
                id=e.id,
                farm_id=e.farm_id,
                category=e.category,
                amount=float(e.amount),
                description=e.description,
                date=e.date,
                created_at=e.created_at,
                labour_ledger_line_id=e.labour_ledger_line_id,
                feed_inventory_id=e.feed_inventory_id,
                linked_labour_id=lid,
                linked_labour_name=lname,
            )
        )
    return out


def _row_dict(e: Expense) -> dict:
    return {
        "category": e.category,
        "amount": float(e.amount),
        "description": e.description,
        "date": str(e.date),
        "labour_ledger_line_id": e.labour_ledger_line_id,
        "feed_inventory_id": e.feed_inventory_id,
    }


@router.post("", response_model=ExpenseOut)
def create_expense(
    farm_id: int,
    body: ExpenseCreate,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    labour_link = body.labour_ledger_line_id
    feed_link = body.feed_inventory_id
    created_fresh_labour_line = False
    expense_description = body.description

    if body.labour_id is not None:
        if body.category.strip() != LABOUR_WAGES_CATEGORY:
            raise HTTPException(
                status_code=400,
                detail="labour_id is only allowed when category is Labour & wages.",
            )
        if labour_link is not None or feed_link is not None:
            raise HTTPException(
                status_code=400,
                detail="Send labour_id by itself for wage expenses, not with other links.",
            )
        labour = (
            db.query(FarmLabour)
            .filter(
                FarmLabour.id == body.labour_id,
                FarmLabour.farm_id == farm_id,
                FarmLabour.is_active == True,
            )
            .first()
        )
        if not labour:
            raise HTTPException(
                status_code=400,
                detail="labour_id must refer to an active person on this farm.",
            )
        amt = Decimal(str(body.amount))
        if amt <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive.")
        desc = (
            body.description.strip()
            if body.description and str(body.description).strip()
            else f"Wage payment — {labour.full_name}"
        )
        expense_description = desc
        line = LabourLedgerLine(
            farm_id=farm_id,
            labour_id=labour.id,
            line_date=body.date,
            line_type="payment",
            amount=amt,
            description=desc,
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
                "line_type": "payment",
                "amount": str(amt),
                "from_expense_wizard": True,
            },
            ip=ip,
        )
        publish_farm_event(
            farm_id,
            "labour_ledger",
            {"labour_id": labour.id, "id": line.id},
        )
        labour_link = line.id
        created_fresh_labour_line = True

    if labour_link is not None and not created_fresh_labour_line:
        line = (
            db.query(LabourLedgerLine)
            .filter(
                LabourLedgerLine.id == labour_link,
                LabourLedgerLine.farm_id == farm_id,
                LabourLedgerLine.line_type == "payment",
            )
            .first()
        )
        if not line:
            raise HTTPException(
                status_code=400,
                detail="labour_ledger_line_id must reference a payment on this farm.",
            )
        if body.category.strip() != LABOUR_WAGES_CATEGORY:
            raise HTTPException(
                status_code=400,
                detail=f"When linking a labour payment, category must be {LABOUR_WAGES_CATEGORY!r}.",
            )
        if Decimal(str(body.amount)) != line.amount:
            raise HTTPException(
                status_code=400,
                detail="Amount must exactly match the linked labour payment.",
            )
        if body.date != line.line_date:
            raise HTTPException(
                status_code=400,
                detail="Expense date must match the labour payment date.",
            )
        if (
            db.query(Expense)
            .filter(Expense.labour_ledger_line_id == line.id)
            .first()
        ):
            raise HTTPException(
                status_code=400,
                detail="That labour payment already has a linked expense.",
            )
    if feed_link is not None:
        feed_row = (
            db.query(FeedInventory)
            .filter(FeedInventory.id == feed_link, FeedInventory.farm_id == farm_id)
            .first()
        )
        if not feed_row:
            raise HTTPException(status_code=400, detail="feed_inventory_id not found on this farm.")
        if body.category.strip() != FEED_FODDER_CATEGORY:
            raise HTTPException(
                status_code=400,
                detail=f"When linking a feed entry, category must be {FEED_FODDER_CATEGORY!r}.",
            )
        if (
            db.query(Expense)
            .filter(Expense.feed_inventory_id == feed_row.id)
            .first()
        ):
            raise HTTPException(
                status_code=400,
                detail="That feed entry already has a linked expense.",
            )
        feed_row.purchase_cost_inr = None
    row = Expense(
        farm_id=farm_id,
        category=body.category,
        amount=Decimal(str(body.amount)),
        description=expense_description,
        date=body.date,
        labour_ledger_line_id=labour_link,
        feed_inventory_id=feed_link,
    )
    db.add(row)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="create",
        resource_type="expense",
        resource_id=row.id,
        before=None,
        after=_row_dict(row),
        ip=ip,
    )
    db.commit()
    db.refresh(row)
    publish_farm_event(farm_id, "expense_created", {"id": row.id})
    return _to_out(db, farm_id, row)


@router.patch("/{expense_id}", response_model=ExpenseOut)
def patch_expense(
    farm_id: int,
    expense_id: int,
    body: ExpenseUpdate,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    row = (
        db.query(Expense).filter(Expense.id == expense_id, Expense.farm_id == farm_id).first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    if row.labour_ledger_line_id is not None or row.feed_inventory_id is not None:
        raise HTTPException(
            status_code=400,
            detail="This expense is linked to labour or feed; remove the link or adjust from the Labour / Feed pages.",
        )
    before = _row_dict(row)
    data = body.model_dump(exclude_unset=True)
    new_cat = data.get("category", row.category)
    new_desc = data["description"] if "description" in data else row.description
    if misc_requires_description(new_cat, new_desc):
        raise HTTPException(
            status_code=422,
            detail="Description is required when category is Miscellaneous.",
        )
    if "category" in data:
        row.category = data["category"]
    if "amount" in data:
        row.amount = Decimal(str(data["amount"]))
    if "description" in data:
        row.description = data["description"]
    if "date" in data:
        row.date = data["date"]
    after = _row_dict(row)
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="update",
        resource_type="expense",
        resource_id=expense_id,
        before=before,
        after=after,
        ip=ip,
    )
    db.commit()
    db.refresh(row)
    publish_farm_event(farm_id, "expense_updated", {"id": expense_id})
    return _to_out(db, farm_id, row)


@router.get("", response_model=Paginated[ExpenseOut])
def list_expenses(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
    dr: tuple = Depends(list_optional_date_range),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    start_date, end_date = dr
    q = db.query(Expense).filter(Expense.farm_id == farm_id)
    if start_date is not None:
        q = q.filter(Expense.date >= start_date)
    if end_date is not None:
        q = q.filter(Expense.date <= end_date)
    q = q.order_by(Expense.date.desc(), Expense.id.desc())
    total = q.count()
    rows = q.offset(page.offset).limit(page.limit).all()
    items = _to_out_many(db, farm_id, rows)
    return Paginated(items=items, total=total, limit=page.limit, offset=page.offset)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    farm_id: int,
    expense_id: int,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    row = (
        db.query(Expense).filter(Expense.id == expense_id, Expense.farm_id == farm_id).first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    if row.labour_ledger_line_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Delete the labour ledger payment to remove this expense (it is linked to that payment).",
        )
    before = _row_dict(row)
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="delete",
        resource_type="expense",
        resource_id=expense_id,
        before=before,
        after=None,
        ip=ip,
    )
    db.delete(row)
    db.commit()
    publish_farm_event(farm_id, "expense_deleted", {"id": expense_id})
