from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import FarmLabour, LabourLedgerLine


def ledger_balance(db: Session, labour_id: int) -> Decimal:
    bal = Decimal("0")
    for line in db.query(LabourLedgerLine).filter(LabourLedgerLine.labour_id == labour_id).all():
        if line.line_type == "earning":
            bal += line.amount
        elif line.line_type == "payment":
            bal -= line.amount
        elif line.line_type == "adjustment":
            bal += line.amount
    return bal


def farm_labour_due_total(db: Session, farm_id: int) -> Decimal:
    """Sum of max(balance, 0) for each person (amounts farm still owes)."""
    labours = db.query(FarmLabour).filter(FarmLabour.farm_id == farm_id).all()
    total = Decimal("0")
    for L in labours:
        b = ledger_balance(db, L.id)
        if b > 0:
            total += b
    return total
