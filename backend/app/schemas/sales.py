from datetime import date as Date
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class SaleCreate(BaseModel):
    buyer_name: str = Field(..., min_length=1, max_length=255)
    trays_sold: int = Field(..., ge=0)
    rate_per_tray: Decimal = Field(..., ge=0)
    total_amount: Decimal = Field(..., ge=0)
    date: Date


class SaleOut(BaseModel):
    id: int
    farm_id: int
    buyer_name: str
    trays_sold: int
    rate_per_tray: float
    total_amount: float
    date: Date
    created_at: datetime

    model_config = {"from_attributes": True}


class SaleUpdate(BaseModel):
    buyer_name: str | None = Field(None, min_length=1, max_length=255)
    trays_sold: int | None = Field(None, ge=0)
    rate_per_tray: Decimal | None = Field(None, ge=0)
    total_amount: Decimal | None = Field(None, ge=0)
    date: Date | None = None
