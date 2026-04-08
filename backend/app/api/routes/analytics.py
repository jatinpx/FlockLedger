from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.farm_access import require_farm_member
from app.api.pagination import LimitOffset, pagination_params
from app.database import get_db
from app.deps import CurrentUser
from app.schemas.analytics import DashboardSummary, EggDailyPoint, FeedDailyPoint, ProfitPoint
from app.schemas.pagination import Paginated
from app.services import analytics_service as asvc
from app.services.flock_service import flock_kind_totals
from app.services.labour_balance import farm_labour_due_total

router = APIRouter(prefix="/farms/{farm_id}/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=DashboardSummary)
def dashboard(farm_id: int, user: CurrentUser, db: Session = Depends(get_db)):
    require_farm_member(db, user.id, farm_id)
    end = date.today()
    start = end - timedelta(days=6)
    usable, _, trays = asvc.egg_stats_for_farm(db, farm_id, start, end)
    tray_stock = asvc.tray_stock_derived(db, farm_id)
    fk = flock_kind_totals(db, farm_id)
    removed = sum(int(fk.get(k, 0) or 0) for k in ("mortality", "cull", "live_sale", "transfer_out"))
    added = sum(int(fk.get(k, 0) or 0) for k in ("purchase", "transfer_in"))
    return DashboardSummary(
        farm_id=farm_id,
        total_birds=asvc.farm_total_birds(db, farm_id),
        tray_stock=tray_stock,
        last_7_days_eggs=usable,
        last_7_days_trays=trays,
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
    days: int = Query(7, ge=1, le=366),
):
    require_farm_member(db, user.id, farm_id)
    full = asvc.daily_egg_series(db, farm_id, days)
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
    days: int = Query(30, ge=1, le=366),
):
    require_farm_member(db, user.id, farm_id)
    full = asvc.feed_series(db, farm_id, days)
    total = len(full)
    slice_ = full[page.offset : page.offset + page.limit]
    items = [FeedDailyPoint(**row) for row in slice_]
    return Paginated(items=items, total=total, limit=page.limit, offset=page.offset)


@router.get("/profit")
def profit_range(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=366),
):
    require_farm_member(db, user.id, farm_id)
    end = date.today()
    start = end - timedelta(days=days - 1)
    return asvc.profit_summary(db, farm_id, start, end)


@router.get("/profit/daily", response_model=Paginated[ProfitPoint])
def profit_daily(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
    days: int = Query(30, ge=1, le=90),
):
    require_farm_member(db, user.id, farm_id)
    end = date.today()
    full: list[dict] = []
    for i in range(days - 1, -1, -1):
        d = end - timedelta(days=i)
        s = asvc.profit_summary(db, farm_id, d, d)
        full.append(
            {
                "date": d.isoformat(),
                "revenue": float(s["revenue"]),
                "expenses": float(s["expenses"]),
                "profit": float(s["profit"]),
            }
        )
    total = len(full)
    slice_ = full[page.offset : page.offset + page.limit]
    items = [ProfitPoint(**row) for row in slice_]
    return Paginated(items=items, total=total, limit=page.limit, offset=page.offset)


@router.get("/tray-stock")
def tray_stock(farm_id: int, user: CurrentUser, db: Session = Depends(get_db)):
    require_farm_member(db, user.id, farm_id)
    return asvc.tray_stock_derived(db, farm_id)
