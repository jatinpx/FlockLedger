from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import EggProduction, FeedInventory, Sale, Shed
from app.services.pl_expenses import merged_expense_amounts_by_date, pl_expense_breakdown
from app.services.reporting_period import (
    bucket_label,
    date_bucket_start,
    iter_bucket_starts_in_range,
)
from app.services.production_service import trays_from_eggs


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


def daily_egg_series_between(db: Session, farm_id: int, start: date, end: date) -> list[dict]:
    rows = (
        db.query(EggProduction.date, EggProduction.eggs_produced, EggProduction.broken_eggs)
        .join(Shed, Shed.id == EggProduction.shed_id)
        .filter(Shed.farm_id == farm_id, EggProduction.date >= start, EggProduction.date <= end)
        .all()
    )
    by_day: dict[date, list[tuple[int, int]]] = defaultdict(list)
    for d, ep, br in rows:
        by_day[d].append((ep, br))

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


def daily_egg_series(db: Session, farm_id: int, days: int) -> list[dict]:
    end = date.today()
    start = end - timedelta(days=days - 1)
    return daily_egg_series_between(db, farm_id, start, end)


def aggregate_egg_series(
    daily_rows: list[dict], start: date, end: date, granularity: str
) -> list[dict]:
    """Roll daily egg points into week/month/quarter/etc. buckets (inclusive range)."""
    if granularity == "day":
        out_day: list[dict] = []
        for r in daily_rows:
            d = date.fromisoformat(r["date"])
            ps = r["date"]
            out_day.append(
                {
                    "period_start": ps,
                    "period_label": d.strftime("%d %b %Y"),
                    "date": ps,
                    "usable_eggs": r["usable_eggs"],
                    "broken_eggs": r["broken_eggs"],
                    "trays": r["trays"],
                }
            )
        return out_day

    acc: dict[date, dict[str, int]] = {}
    for r in daily_rows:
        d = date.fromisoformat(r["date"])
        if d < start or d > end:
            continue
        bs = date_bucket_start(d, granularity)
        if bs not in acc:
            acc[bs] = {"usable_eggs": 0, "broken_eggs": 0}
        acc[bs]["usable_eggs"] += r["usable_eggs"]
        acc[bs]["broken_eggs"] += r["broken_eggs"]

    out: list[dict] = []
    for bs in iter_bucket_starts_in_range(start, end, granularity):
        blk = acc.get(bs)
        u = blk["usable_eggs"] if blk else 0
        b = blk["broken_eggs"] if blk else 0
        ps = bs.isoformat()
        out.append(
            {
                "period_start": ps,
                "period_label": bucket_label(bs, granularity),
                "date": ps,
                "usable_eggs": u,
                "broken_eggs": b,
                "trays": trays_from_eggs(u),
            }
        )
    return out


def feed_series_between(db: Session, farm_id: int, start: date, end: date) -> list[dict]:
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


def feed_series(db: Session, farm_id: int, days: int) -> list[dict]:
    end = date.today()
    start = end - timedelta(days=days - 1)
    return feed_series_between(db, farm_id, start, end)


def aggregate_feed_series(
    rows: list[dict], start: date, end: date, granularity: str
) -> list[dict]:
    if granularity == "day":
        out_fd: list[dict] = []
        for r in rows:
            d = date.fromisoformat(r["date"])
            ps = r["date"]
            out_fd.append(
                {
                    "period_start": ps,
                    "period_label": d.strftime("%d %b %Y"),
                    "date": ps,
                    "feed_received": r["feed_received"],
                    "feed_used": r["feed_used"],
                    "feed_remaining": r["feed_remaining"],
                }
            )
        return out_fd

    by_bucket: dict[date, list[dict]] = defaultdict(list)
    for r in rows:
        d = date.fromisoformat(r["date"])
        if d < start or d > end:
            continue
        by_bucket[date_bucket_start(d, granularity)].append(r)

    out: list[dict] = []
    for bs in iter_bucket_starts_in_range(start, end, granularity):
        bucket_rows = sorted(by_bucket.get(bs, []), key=lambda x: x["date"])
        rec = sum(float(x["feed_received"]) for x in bucket_rows)
        used = sum(float(x["feed_used"]) for x in bucket_rows)
        rem = float(bucket_rows[-1]["feed_remaining"]) if bucket_rows else 0.0
        ps = bs.isoformat()
        out.append(
            {
                "period_start": ps,
                "period_label": bucket_label(bs, granularity),
                "date": ps,
                "feed_received": rec,
                "feed_used": used,
                "feed_remaining": rem,
            }
        )
    return out


def _sales_amounts_by_date(db: Session, farm_id: int, start: date, end: date) -> dict[date, Decimal]:
    rows = (
        db.query(Sale.date, Sale.total_amount)
        .filter(Sale.farm_id == farm_id, Sale.date >= start, Sale.date <= end)
        .all()
    )
    acc: dict[date, Decimal] = defaultdict(lambda: Decimal("0"))
    for d, amt in rows:
        acc[d] += Decimal(str(amt))
    return acc


def daily_profit_series(db: Session, farm_id: int, start: date, end: date) -> list[dict]:
    sales_m = _sales_amounts_by_date(db, farm_id, start, end)
    exp_m = merged_expense_amounts_by_date(db, farm_id, start, end)
    out: list[dict] = []
    cur = start
    while cur <= end:
        rev = float(sales_m.get(cur, Decimal("0")))
        exp = float(exp_m.get(cur, Decimal("0")))
        out.append(
            {
                "date": cur.isoformat(),
                "revenue": rev,
                "expenses": exp,
                "profit": rev - exp,
            }
        )
        cur += timedelta(days=1)
    return out


def aggregate_profit_series(
    daily: list[dict], start: date, end: date, granularity: str
) -> list[dict]:
    if granularity == "day":
        out_pd: list[dict] = []
        for r in daily:
            d = date.fromisoformat(r["date"])
            ps = r["date"]
            out_pd.append(
                {
                    "period_start": ps,
                    "period_label": d.strftime("%d %b %Y"),
                    "date": ps,
                    "revenue": r["revenue"],
                    "expenses": r["expenses"],
                    "profit": r["profit"],
                }
            )
        return out_pd

    acc: dict[date, dict[str, float]] = {}
    for r in daily:
        d = date.fromisoformat(r["date"])
        if d < start or d > end:
            continue
        bs = date_bucket_start(d, granularity)
        if bs not in acc:
            acc[bs] = {"revenue": 0.0, "expenses": 0.0, "profit": 0.0}
        acc[bs]["revenue"] += r["revenue"]
        acc[bs]["expenses"] += r["expenses"]
        acc[bs]["profit"] += r["profit"]

    out: list[dict] = []
    for bs in iter_bucket_starts_in_range(start, end, granularity):
        a = acc.get(bs, {"revenue": 0.0, "expenses": 0.0, "profit": 0.0})
        ps = bs.isoformat()
        out.append(
            {
                "period_start": ps,
                "period_label": bucket_label(bs, granularity),
                "date": ps,
                "revenue": a["revenue"],
                "expenses": a["expenses"],
                "profit": a["profit"],
            }
        )
    return out


def sales_total(db: Session, farm_id: int, start: date, end: date) -> Decimal:
    q = (
        db.query(func.coalesce(func.sum(Sale.total_amount), 0))
        .filter(Sale.farm_id == farm_id, Sale.date >= start, Sale.date <= end)
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
    br = pl_expense_breakdown(db, farm_id, start, end)
    exp = Decimal(str(br["total"]))
    profit = float(rev - exp)
    usable, _, _ = egg_stats_for_farm(db, farm_id, start, end)
    cost_per_egg = None
    if usable > 0:
        cost_per_egg = float(exp / usable)
    return {
        "revenue": float(rev),
        "expenses": float(exp),
        "profit": profit,
        "cost_per_egg": cost_per_egg,
        "usable_eggs_in_period": usable,
        "expense_breakdown": br,
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
