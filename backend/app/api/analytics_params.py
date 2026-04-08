"""Shared query parsing for analytics date ranges and granularity."""

from datetime import date, timedelta

from fastapi import HTTPException, Query

from app.services.reporting_period import GRANULARITIES, resolve_analytics_range


def analytics_period(
    start_date: date | None = Query(
        None, description="Inclusive period start (optional; use with end_date or alone up to today)"
    ),
    end_date: date | None = Query(
        None, description="Inclusive period end (optional; capped at today; default window ends here)"
    ),
    days: int | None = Query(
        None,
        ge=1,
        le=800,
        description="When neither start_date nor end_date is set: length of window ending today (default 30). Ignored if any date is set.",
    ),
    granularity: str = Query(
        "day",
        description="Bucket size for time series: day, week, month, quarter, half_year, year",
    ),
) -> tuple[date, date, str]:
    if granularity not in GRANULARITIES:
        raise HTTPException(
            status_code=400,
            detail=f"granularity must be one of: {', '.join(sorted(GRANULARITIES))}",
        )
    try:
        if start_date is not None or end_date is not None:
            start, end = resolve_analytics_range(
                start_date, end_date, default_days=days or 30
            )
        elif days is not None:
            end = date.today()
            start = end - timedelta(days=days - 1)
        else:
            start, end = resolve_analytics_range(None, None, default_days=30)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return start, end, granularity


def analytics_period_summary(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    days: int | None = Query(None, ge=1, le=800),
) -> tuple[date, date]:
    """Same range rules without granularity (dashboard, profit summary)."""
    try:
        if start_date is not None or end_date is not None:
            start, end = resolve_analytics_range(
                start_date, end_date, default_days=days or 30
            )
        elif days is not None:
            end = date.today()
            start = end - timedelta(days=days - 1)
        else:
            start, end = resolve_analytics_range(None, None, default_days=30)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return start, end


def list_optional_date_range(
    start_date: date | None = Query(None, description="Filter: on or after this date"),
    end_date: date | None = Query(None, description="Filter: on or before this date"),
) -> tuple[date | None, date | None]:
    if start_date is not None and end_date is not None and start_date > end_date:
        raise HTTPException(
            status_code=400, detail="start_date must be on or before end_date"
        )
    return start_date, end_date
