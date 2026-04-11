from fastapi import APIRouter, Depends

from sqlalchemy.orm import Session

from app.api.analytics_params import analytics_period, analytics_period_summary
from app.api.farm_access import require_farm_role
from app.api.pagination import LimitOffset, pagination_params
from app.database import get_db
from app.deps import CurrentUser
from app.schemas.analytics import (
    DashboardSummary,
    EggDailyPoint,
    FeedDailyPoint,
    ProfitExpenseBreakdown,
    ProfitPoint,
    ProfitSummaryOut,
)
from app.schemas.pagination import Paginated
from app.services import analytics_service as asvc
from app.services.flock_service import flock_kind_totals_range
from app.services.labour_balance import farm_labour_due_total

router = APIRouter(prefix="/farms/{farm_id}/analytics", tags=["analytics"])

MANAGER_ROLES = ("owner", "manager")


@router.get(
    "/dashboard",
    response_model=DashboardSummary,
    summary="Dashboard KPIs for the selected period",
    description=(
        "`labour_due_total` is the sum of max(0, running ledger balance) across all labour rows "
        "(cumulative owed). For month-scoped accrual and paid amounts, use "
        "`GET /farms/{farm_id}/labour/payroll`."
    ),
)
def dashboard(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    period: tuple = Depends(analytics_period_summary),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    start, end = period
    usable, _, trays = asvc.egg_stats_for_farm(db, farm_id, start, end)
    tray_stock = asvc.tray_stock_derived(db, farm_id)
    fk = flock_kind_totals_range(db, farm_id, start, end)
    removed = sum(int(fk.get(k, 0) or 0) for k in ("mortality", "cull", "live_sale", "transfer_out"))
    added = sum(int(fk.get(k, 0) or 0) for k in ("purchase", "transfer_in"))
    return DashboardSummary(
        farm_id=farm_id,
        period_start=start.isoformat(),
        period_end=end.isoformat(),
        period_usable_eggs=usable,
        period_trays=trays,
        total_birds=asvc.farm_total_birds(db, farm_id),
        tray_stock=tray_stock,
        labour_due_total=float(farm_labour_due_total(db, farm_id)),
        flock_mortality_total=int(fk.get("mortality", 0) or 0),
        flock_birds_added_total=added,
        flock_birds_removed_total=removed,
    )


@router.get("/eggs/daily", response_model=Paginated[EggDailyPoint])
def eggs_daily(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
    period: tuple = Depends(analytics_period),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    start, end, granularity = period
    daily = asvc.daily_egg_series_between(db, farm_id, start, end)
    full = asvc.aggregate_egg_series(daily, start, end, granularity)
    total = len(full)
    slice_ = full[page.offset : page.offset + page.limit]
    items = [EggDailyPoint(**row) for row in slice_]
    return Paginated(items=items, total=total, limit=page.limit, offset=page.offset)


@router.get("/feed/daily", response_model=Paginated[FeedDailyPoint])
def feed_daily(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
    period: tuple = Depends(analytics_period),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    start, end, granularity = period
    raw = asvc.feed_series_between(db, farm_id, start, end)
    full = asvc.aggregate_feed_series(raw, start, end, granularity)
    total = len(full)
    slice_ = full[page.offset : page.offset + page.limit]
    items = [FeedDailyPoint(**row) for row in slice_]
    return Paginated(items=items, total=total, limit=page.limit, offset=page.offset)


@router.get("/profit", response_model=ProfitSummaryOut)
def profit_range(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    period: tuple = Depends(analytics_period_summary),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    start, end = period
    s = asvc.profit_summary(db, farm_id, start, end)
    br = s["expense_breakdown"]
    return ProfitSummaryOut(
        period_start=start.isoformat(),
        period_end=end.isoformat(),
        revenue=s["revenue"],
        expenses=s["expenses"],
        profit=s["profit"],
        cost_per_egg=s["cost_per_egg"],
        usable_eggs_in_period=int(s.get("usable_eggs_in_period", 0) or 0),
        expense_breakdown=ProfitExpenseBreakdown(
            expense_entries=br["expense_entries"],
            unlinked_labour_payments=br["unlinked_labour_payments"],
            feed_purchase_cost_on_entries=br["feed_purchase_cost_on_entries"],
            total=br["total"],
        ),
    )


@router.get("/profit/daily", response_model=Paginated[ProfitPoint])
def profit_daily(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
    period: tuple = Depends(analytics_period),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    start, end, granularity = period
    daily = asvc.daily_profit_series(db, farm_id, start, end)
    full = asvc.aggregate_profit_series(daily, start, end, granularity)
    total = len(full)
    slice_ = full[page.offset : page.offset + page.limit]
    items = [ProfitPoint(**row) for row in slice_]
    return Paginated(items=items, total=total, limit=page.limit, offset=page.offset)


@router.get("/tray-stock")
def tray_stock(farm_id: int, user: CurrentUser, db: Session = Depends(get_db)):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    return asvc.tray_stock_derived(db, farm_id)
