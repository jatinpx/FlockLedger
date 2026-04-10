from datetime import date as Date
from datetime import datetime
from decimal import Decimal
from typing import Any, Callable

from pydantic import BaseModel, Field, field_validator, model_validator

from app.services.production_service import EGGS_PER_TRAY


def _money2(d: Decimal) -> Decimal:
    return d.quantize(Decimal("0.01"))


class SaleCreate(BaseModel):
    buyer_name: str = Field(..., min_length=1, max_length=255)
    trays_sold: int = Field(..., ge=0)
    total_amount: Decimal = Field(..., ge=0)
    date: Date
    # Optional at JSON level: wrap validator fills rate_per_tray from rate_per_egg before validation.
    rate_per_tray: Decimal | None = Field(default=None)
    rate_per_egg: Decimal | None = Field(default=None)

    @field_validator("rate_per_tray", "rate_per_egg", mode="before")
    @classmethod
    def coerce_decimal(cls, v: Any) -> Any:
        if v is None:
            return None
        return Decimal(str(v))

    @field_validator("rate_per_tray", "rate_per_egg")
    @classmethod
    def non_negative_rate(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v < 0:
            raise ValueError("rate must be >= 0")
        return v

    @field_validator("date")
    @classmethod
    def date_cannot_be_future(cls, v: Date) -> Date:
        if v > Date.today():
            raise ValueError("date cannot be in the future")
        return v

    @model_validator(mode="wrap")
    @classmethod
    def derive_tray_from_egg(
        cls,
        data: Any,
        handler: Callable[[Any], Any],
    ) -> Any:
        if isinstance(data, dict):
            rt, re = data.get("rate_per_tray"), data.get("rate_per_egg")
            if rt is None and re is not None:
                egg = Decimal(str(re))
                data = {
                    **data,
                    "rate_per_tray": _money2(egg * Decimal(EGGS_PER_TRAY)),
                }
        return handler(data)

    @model_validator(mode="after")
    def require_rate_and_consistency(self):
        if self.rate_per_tray is None:
            raise ValueError("Provide rate_per_tray or rate_per_egg")
        if self.rate_per_egg is not None:
            exp = _money2(self.rate_per_egg * Decimal(EGGS_PER_TRAY))
            if abs(self.rate_per_tray - exp) > Decimal("0.02"):
                raise ValueError(
                    f"rate_per_tray must equal rate_per_egg × {EGGS_PER_TRAY} (expected {exp})"
                )
        return self


class SaleOut(BaseModel):
    id: int
    farm_id: int
    buyer_name: str
    trays_sold: int
    rate_per_tray: float
    rate_per_egg: float
    total_amount: float
    date: Date
    created_at: datetime

    model_config = {"from_attributes": True}


class SaleUpdate(BaseModel):
    buyer_name: str | None = Field(None, min_length=1, max_length=255)
    trays_sold: int | None = Field(None, ge=0)
    rate_per_tray: Decimal | None = Field(None, ge=0)
    rate_per_egg: Decimal | None = Field(None, ge=0)
    total_amount: Decimal | None = Field(None, ge=0)
    date: Date | None = None
    @field_validator("date")
    @classmethod
    def date_cannot_be_future(cls, v: Date | None) -> Date | None:
        if v is not None and v > Date.today():
            raise ValueError("date cannot be in the future")
        return v