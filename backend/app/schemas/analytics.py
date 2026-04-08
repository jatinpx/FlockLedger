from pydantic import BaseModel, Field


class EggDailyPoint(BaseModel):
    period_start: str = Field(description="ISO date of bucket start")
    period_label: str = Field(description="Human-readable bucket label for charts")
    date: str = Field(description="Same as period_start; kept for chart dataKey compatibility")
    usable_eggs: int
    broken_eggs: int
    trays: int


class FeedDailyPoint(BaseModel):
    period_start: str
    period_label: str
    date: str
    feed_received: float
    feed_used: float
    feed_remaining: float


class DashboardSummary(BaseModel):
    farm_id: int
    period_start: str
    period_end: str
    period_usable_eggs: int
    period_trays: int
    total_birds: int
    tray_stock: dict
    labour_due_total: float = Field(
        0,
        description=(
            "Sum over all labour rows of max(0, running ledger balance): cumulative earnings "
            "minus payments plus adjustments. Not the same as “accrual minus paid” for a single "
            "calendar month (see GET /farms/{farm_id}/labour/payroll)."
        ),
    )
    flock_mortality_total: int = 0
    flock_birds_added_total: int = 0
    flock_birds_removed_total: int = 0


class ProfitPoint(BaseModel):
    period_start: str
    period_label: str
    date: str
    revenue: float
    expenses: float
    profit: float


class ProfitExpenseBreakdown(BaseModel):
    """How P&L expenses are composed (sums to the same value as `expenses`)."""

    expense_entries: float
    unlinked_labour_payments: float
    feed_purchase_cost_on_entries: float
    total: float


class ProfitSummaryOut(BaseModel):
    period_start: str
    period_end: str
    revenue: float
    expenses: float
    profit: float
    cost_per_egg: float | None
    usable_eggs_in_period: int = 0
    expense_breakdown: ProfitExpenseBreakdown
