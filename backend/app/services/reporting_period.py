"""Resolve analytics date ranges and calendar bucket labels (day → year)."""

from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta
from typing import Literal

Granularity = Literal["day", "week", "month", "quarter", "half_year", "year"]

GRANULARITIES: frozenset[str] = frozenset(
    {"day", "week", "month", "quarter", "half_year", "year"}
)


def resolve_analytics_range(
    start_date: date | None,
    end_date: date | None,
    *,
    today: date | None = None,
    default_days: int = 30,
) -> tuple[date, date]:
    """
    - Both dates: inclusive range [start, end], end capped at today.
    - Start only: [start, today] (today if start > today).
    - End only: last `default_days` ending on end (capped at today).
    - Neither: last `default_days` ending today.
    """
    t = today or date.today()
    if default_days < 1:
        default_days = 30

    if start_date is not None and end_date is not None:
        if start_date > end_date:
            raise ValueError("start_date must be on or before end_date")
        end = min(end_date, t)
        start = min(start_date, end)
        if start > end:
            start = end
        return start, end

    if start_date is not None:
        start = start_date
        end = max(start, t)
        return start, end

    if end_date is not None:
        end = min(end_date, t)
        start = end - timedelta(days=default_days - 1)
        return start, end

    end = t
    start = end - timedelta(days=default_days - 1)
    return start, end


def date_bucket_start(d: date, granularity: str) -> date:
    if granularity == "day":
        return d
    if granularity == "week":
        return d - timedelta(days=d.weekday())
    if granularity == "month":
        return date(d.year, d.month, 1)
    if granularity == "quarter":
        q = (d.month - 1) // 3
        return date(d.year, q * 3 + 1, 1)
    if granularity == "half_year":
        return date(d.year, 1 if d.month <= 6 else 7, 1)
    if granularity == "year":
        return date(d.year, 1, 1)
    raise ValueError(f"unknown granularity: {granularity}")


def bucket_label(bucket_start: date, granularity: str) -> str:
    if granularity == "day":
        return bucket_start.strftime("%d %b %Y")
    if granularity == "week":
        y, w, _ = bucket_start.isocalendar()
        return f"{y}-W{w:02d}"
    if granularity == "month":
        return bucket_start.strftime("%b %Y")
    if granularity == "quarter":
        q = (bucket_start.month - 1) // 3 + 1
        return f"Q{q} {bucket_start.year}"
    if granularity == "half_year":
        h = 1 if bucket_start.month <= 6 else 2
        return f"H{h} {bucket_start.year}"
    if granularity == "year":
        return str(bucket_start.year)
    raise ValueError(f"unknown granularity: {granularity}")


def month_add(d: date, months: int) -> date:
    y, m = d.year, d.month + months
    while m > 12:
        m -= 12
        y += 1
    while m < 1:
        m += 12
        y -= 1
    last = monthrange(y, m)[1]
    return date(y, m, min(d.day, last))


def bucket_end_inclusive(bucket_start: date, granularity: str) -> date:
    """Last calendar day inside the same bucket as bucket_start."""
    if granularity == "day":
        return bucket_start
    if granularity == "week":
        return bucket_start + timedelta(days=6)
    if granularity == "month":
        last = monthrange(bucket_start.year, bucket_start.month)[1]
        return date(bucket_start.year, bucket_start.month, last)
    if granularity == "quarter":
        qstart_month = (bucket_start.month - 1) // 3 * 3 + 1
        mend = qstart_month + 2
        last = monthrange(bucket_start.year, mend)[1]
        return date(bucket_start.year, mend, last)
    if granularity == "half_year":
        if bucket_start.month == 1:
            return date(bucket_start.year, 6, 30)
        return date(bucket_start.year, 12, 31)
    if granularity == "year":
        return date(bucket_start.year, 12, 31)
    raise ValueError(f"unknown granularity: {granularity}")


def iter_bucket_starts_in_range(start: date, end: date, granularity: str) -> list[date]:
    """Ordered bucket start dates overlapping [start, end] (inclusive)."""
    if start > end:
        return []
    if granularity == "day":
        return [start + timedelta(days=i) for i in range((end - start).days + 1)]

    cur = date_bucket_start(start, granularity)
    while bucket_end_inclusive(cur, granularity) < start:
        cur = _advance_bucket_start(cur, granularity)

    out: list[date] = []
    while cur <= end:
        out.append(cur)
        cur = _advance_bucket_start(cur, granularity)
    return out


def _advance_bucket_start(cur: date, granularity: str) -> date:
    if granularity == "week":
        return cur + timedelta(days=7)
    if granularity == "month":
        return month_add(cur, 1)
    if granularity == "quarter":
        q = (cur.month - 1) // 3
        if q == 3:
            return date(cur.year + 1, 1, 1)
        return date(cur.year, (q + 1) * 3 + 1, 1)
    if granularity == "half_year":
        return date(cur.year + 1, 1, 1) if cur.month >= 7 else date(cur.year, 7, 1)
    if granularity == "year":
        return date(cur.year + 1, 1, 1)
    raise ValueError(granularity)
