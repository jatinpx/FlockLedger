"""Profit & loss expense totals: expense rows + unlinked labour payments + feed purchase cost."""

from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Expense, FeedInventory, LabourLedgerLine


def _expense_table_sum(db: Session, farm_id: int, start: date, end: date) -> Decimal:
    from sqlalchemy import func

    q = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.farm_id == farm_id,
            Expense.date >= start,
            Expense.date <= end,
        )
        .scalar()
    )
    return Decimal(str(q or 0))


def _unlinked_labour_payment_sum(db: Session, farm_id: int, start: date, end: date) -> Decimal:
    linked_ids = {
        r[0]
        for r in db.query(Expense.labour_ledger_line_id)
        .filter(
            Expense.farm_id == farm_id,
            Expense.labour_ledger_line_id.isnot(None),
        )
        .all()
        if r[0] is not None
    }
    total = Decimal("0")
    for p in (
        db.query(LabourLedgerLine)
        .filter(
            LabourLedgerLine.farm_id == farm_id,
            LabourLedgerLine.line_type == "payment",
            LabourLedgerLine.line_date >= start,
            LabourLedgerLine.line_date <= end,
        )
        .all()
    ):
        if p.id not in linked_ids:
            total += Decimal(str(p.amount))
    return total


def _unlinked_feed_purchase_sum(db: Session, farm_id: int, start: date, end: date) -> Decimal:
    linked_feed = {
        r[0]
        for r in db.query(Expense.feed_inventory_id)
        .filter(
            Expense.farm_id == farm_id,
            Expense.feed_inventory_id.isnot(None),
        )
        .all()
        if r[0] is not None
    }
    total = Decimal("0")
    for f in (
        db.query(FeedInventory)
        .filter(
            FeedInventory.farm_id == farm_id,
            FeedInventory.date >= start,
            FeedInventory.date <= end,
        )
        .all()
    ):
        if f.id in linked_feed:
            continue
        if f.purchase_cost_inr is not None:
            total += Decimal(str(f.purchase_cost_inr))
    return total


def pl_expense_breakdown(db: Session, farm_id: int, start: date, end: date) -> dict[str, float]:
    """Components that sum to total P&L expenses (no double counting)."""
    table = _expense_table_sum(db, farm_id, start, end)
    labour_orphan = _unlinked_labour_payment_sum(db, farm_id, start, end)
    feed_orphan = _unlinked_feed_purchase_sum(db, farm_id, start, end)
    total = table + labour_orphan + feed_orphan
    return {
        "expense_entries": float(table),
        "unlinked_labour_payments": float(labour_orphan),
        "feed_purchase_cost_on_entries": float(feed_orphan),
        "total": float(total),
    }


def merged_expense_amounts_by_date(
    db: Session, farm_id: int, start: date, end: date
) -> dict[date, Decimal]:
    """Per-day amounts for profit charts (cash-style outflows)."""
    acc: dict[date, Decimal] = defaultdict(lambda: Decimal("0"))
    for d, amt in (
        db.query(Expense.date, Expense.amount)
        .filter(
            Expense.farm_id == farm_id,
            Expense.date >= start,
            Expense.date <= end,
        )
        .all()
    ):
        acc[d] += Decimal(str(amt))
    linked_labour = {
        r[0]
        for r in db.query(Expense.labour_ledger_line_id)
        .filter(
            Expense.farm_id == farm_id,
            Expense.labour_ledger_line_id.isnot(None),
        )
        .all()
        if r[0] is not None
    }
    for p in (
        db.query(LabourLedgerLine)
        .filter(
            LabourLedgerLine.farm_id == farm_id,
            LabourLedgerLine.line_type == "payment",
            LabourLedgerLine.line_date >= start,
            LabourLedgerLine.line_date <= end,
        )
        .all()
    ):
        if p.id not in linked_labour:
            acc[p.line_date] += Decimal(str(p.amount))
    linked_feed = {
        r[0]
        for r in db.query(Expense.feed_inventory_id)
        .filter(
            Expense.farm_id == farm_id,
            Expense.feed_inventory_id.isnot(None),
        )
        .all()
        if r[0] is not None
    }
    for f in (
        db.query(FeedInventory)
        .filter(
            FeedInventory.farm_id == farm_id,
            FeedInventory.date >= start,
            FeedInventory.date <= end,
        )
        .all()
    ):
        if f.id in linked_feed:
            continue
        if f.purchase_cost_inr is not None:
            acc[f.date] += Decimal(str(f.purchase_cost_inr))
    return acc


def total_pl_expenses(db: Session, farm_id: int, start: date, end: date) -> Decimal:
    m = merged_expense_amounts_by_date(db, farm_id, start, end)
    return sum(m.values(), Decimal("0"))
