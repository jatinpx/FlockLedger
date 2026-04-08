from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import EggProduction, Expense, FeedInventory, Sale, Shed


def farm_total_birds(db: Session, farm_id: int) -> int:
    q = (
        db.query(func.coalesce(func.sum(Shed.bird_count), 0))
        .filter(Shed.farm_id == farm_id)
        .scalar()
    )
    return int(q or 0)


def egg_stats_for_farm(
    db: Session, farm_id: int, start: date, end: date
) -> tuple[int, int, int]:
    """Returns (total_usable_eggs, total_broken, tray_equivalent)."""
    rows = (
        db.query(EggProduction.eggs_produced, EggProduction.broken_eggs)
        .join(Shed, Shed.id == EggProduction.shed_id)
        .filter(Shed.farm_id == farm_id, EggProduction.date >= start, EggProduction.date <= end)
        .all()
    )
    usable = 0
    broken = 0
    for ep, br in rows:
        usable += max(0, ep - br)
        broken += br
    from app.services.production_service import trays_from_eggs

    trays = trays_from_eggs(usable)
    return usable, broken, trays


def daily_egg_series(db: Session, farm_id: int, days: int) -> list[dict]:
    end = date.today()
    start = end - timedelta(days=days - 1)
    rows = (
        db.query(EggProduction.date, EggProduction.eggs_produced, EggProduction.broken_eggs)
        .join(Shed, Shed.id == EggProduction.shed_id)
        .filter(Shed.farm_id == farm_id, EggProduction.date >= start, EggProduction.date <= end)
        .all()
    )
    by_day: dict[date, list[tuple[int, int]]] = defaultdict(list)
    for d, ep, br in rows:
        by_day[d].append((ep, br))
    from app.services.production_service import trays_from_eggs

    out: list[dict] = []
    cur = start
    while cur <= end:
        day_rows = by_day.get(cur, [])
        usable = sum(max(0, ep - br) for ep, br in day_rows)
        broken = sum(br for _, br in day_rows)
        out.append(
            {
                "date": cur.isoformat(),
                "usable_eggs": usable,
                "broken_eggs": broken,
                "trays": trays_from_eggs(usable),
            }
        )
        cur += timedelta(days=1)
    return out


def feed_series(db: Session, farm_id: int, days: int) -> list[dict]:
    end = date.today()
    start = end - timedelta(days=days - 1)
    rows = (
        db.query(FeedInventory)
        .filter(
            FeedInventory.farm_id == farm_id,
            FeedInventory.date >= start,
            FeedInventory.date <= end,
        )
        .order_by(FeedInventory.date)
        .all()
    )
    return [
        {
            "date": r.date.isoformat(),
            "feed_received": float(r.feed_received),
            "feed_used": float(r.feed_used),
            "feed_remaining": float(r.feed_remaining),
        }
        for r in rows
    ]


def sales_total(db: Session, farm_id: int, start: date, end: date) -> Decimal:
    q = (
        db.query(func.coalesce(func.sum(Sale.total_amount), 0))
        .filter(Sale.farm_id == farm_id, Sale.date >= start, Sale.date <= end)
        .scalar()
    )
    return Decimal(str(q or 0))


def expenses_total(db: Session, farm_id: int, start: date, end: date) -> Decimal:
    q = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(Expense.farm_id == farm_id, Expense.date >= start, Expense.date <= end)
        .scalar()
    )
    return Decimal(str(q or 0))


def trays_sold_total(db: Session, farm_id: int, start: date, end: date) -> int:
    q = (
        db.query(func.coalesce(func.sum(Sale.trays_sold), 0))
        .filter(Sale.farm_id == farm_id, Sale.date >= start, Sale.date <= end)
        .scalar()
    )
    return int(q or 0)


def profit_summary(db: Session, farm_id: int, start: date, end: date) -> dict:
    rev = sales_total(db, farm_id, start, end)
    exp = expenses_total(db, farm_id, start, end)
    profit = rev - exp
    usable, _, _ = egg_stats_for_farm(db, farm_id, start, end)
    cost_per_egg = None
    if usable > 0:
        cost_per_egg = float(exp / usable)
    return {
        "revenue": float(rev),
        "expenses": float(exp),
        "profit": float(profit),
        "cost_per_egg": cost_per_egg,
        "usable_eggs_in_period": usable,
    }


def tray_stock_derived(db: Session, farm_id: int, as_of: date | None = None) -> dict:
    """Trays from production minus trays sold (all time up to as_of)."""
    as_of = as_of or date.today()
    epoch = date(1970, 1, 1)
    usable, _, trays_produced = egg_stats_for_farm(db, farm_id, epoch, as_of)
    sold = trays_sold_total(db, farm_id, epoch, as_of)
    remaining = max(0, trays_produced - sold)
    return {
        "trays_produced_equivalent": trays_produced,
        "trays_sold": sold,
        "trays_in_stock": remaining,
        "usable_eggs_equivalent": usable,
    }
