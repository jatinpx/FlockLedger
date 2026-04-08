from pydantic import BaseModel


class EggDailyPoint(BaseModel):
    date: str
    usable_eggs: int
    broken_eggs: int
    trays: int


class FeedDailyPoint(BaseModel):
    date: str
    feed_received: float
    feed_used: float
    feed_remaining: float


class DashboardSummary(BaseModel):
    farm_id: int
    total_birds: int
    tray_stock: dict
    last_7_days_eggs: int
    last_7_days_trays: int


class ProfitPoint(BaseModel):
    date: str
    revenue: float
    expenses: float
    profit: float
