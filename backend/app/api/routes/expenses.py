from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.analytics_params import list_optional_date_range
from app.api.farm_access import require_farm_role
from app.api.pagination import LimitOffset, pagination_params
from app.database import get_db
from app.deps import ClientIp, CurrentUser
from app.constants.expense_categories import misc_requires_description
from app.models import Expense
from app.schemas.expenses import ExpenseCreate, ExpenseOut, ExpenseUpdate
from app.schemas.pagination import Paginated
from app.services.audit_service import record_audit
from app.services.redis_events import publish_farm_event

router = APIRouter(prefix="/farms/{farm_id}/expenses", tags=["expenses"])

MANAGER_ROLES = ("owner", "manager")


def _to_out(e: Expense) -> ExpenseOut:
    return ExpenseOut(
        id=e.id,
        farm_id=e.farm_id,
        category=e.category,
        amount=float(e.amount),
        description=e.description,
        date=e.date,
        created_at=e.created_at,
    )


def _row_dict(e: Expense) -> dict:
    return {
        "category": e.category,
        "amount": float(e.amount),
        "description": e.description,
        "date": str(e.date),
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
    row = Expense(
        farm_id=farm_id,
        category=body.category,
        amount=Decimal(str(body.amount)),
        description=body.description,
        date=body.date,
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
    return _to_out(row)


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
    return _to_out(row)


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
    items = [_to_out(r) for r in rows]
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
