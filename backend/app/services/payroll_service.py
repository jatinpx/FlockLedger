"""Month-scoped payroll helpers (calendar month; accrual dated last day of month).

Dashboard ``labour_due_total`` uses running ledger balances (see ``farm_labour_due_total``), not
month-only accrual minus paid. Month fields on the payroll API are for the Labour UI period view.
"""

import calendar
import datetime as dt
import re
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import LabourLedgerLine

_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")

PAYROLL_ACCRUAL_PREFIX = "Payroll accrual "


def validate_month_str(month: str) -> None:
    if not _MONTH_RE.match(month):
        raise ValueError("month must be YYYY-MM")
    y, m = int(month[:4]), int(month[5:7])
    if m < 1 or m > 12:
        raise ValueError("invalid month")


def month_bounds(month: str) -> tuple[dt.date, dt.date]:
    validate_month_str(month)
    y, m = int(month[:4]), int(month[5:7])
    start = dt.date(y, m, 1)
    last = calendar.monthrange(y, m)[1]
    end = dt.date(y, m, last)
    return start, end


def accrual_line_date(month: str) -> dt.date:
    """Earning line date for a booked monthly salary (last calendar day of that month)."""
    _start, end = month_bounds(month)
    return end


def accrual_description(month: str) -> str:
    return f"{PAYROLL_ACCRUAL_PREFIX}{month}"


def find_payroll_accrual_line(
    db: Session, labour_id: int, month: str
) -> LabourLedgerLine | None:
    return (
        db.query(LabourLedgerLine)
        .filter(
            LabourLedgerLine.labour_id == labour_id,
            LabourLedgerLine.line_type == "earning",
            LabourLedgerLine.description == accrual_description(month),
        )
        .first()
    )


def sum_ledger_in_month(
    db: Session,
    labour_id: int,
    start: dt.date,
    end: dt.date,
    line_type: str,
) -> Decimal:
    total = (
        db.query(func.coalesce(func.sum(LabourLedgerLine.amount), 0))
        .filter(
            LabourLedgerLine.labour_id == labour_id,
            LabourLedgerLine.line_type == line_type,
            LabourLedgerLine.line_date >= start,
            LabourLedgerLine.line_date <= end,
        )
        .scalar()
    )
    return Decimal(str(total or 0))


def current_month_str(today: dt.date | None = None) -> str:
    d = today or dt.date.today()
    return f"{d.year:04d}-{d.month:02d}"
