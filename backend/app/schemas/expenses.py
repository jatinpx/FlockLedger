from datetime import date as Date
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ExpenseCreate(BaseModel):
    category: str = Field(..., min_length=1, max_length=128)
    amount: Decimal = Field(..., ge=0)
    description: str | None = None
    date: Date


class ExpenseOut(BaseModel):
    id: int
    farm_id: int
    category: str
    amount: float
    description: str | None
    date: Date
    created_at: datetime

    model_config = {"from_attributes": True}


class ExpenseUpdate(BaseModel):
    category: str | None = Field(None, min_length=1, max_length=128)
    amount: Decimal | None = Field(None, ge=0)
    description: str | None = None
    date: Date | None = None
