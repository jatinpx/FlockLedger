from datetime import date as Date
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class EggProductionCreate(BaseModel):
    shed_id: int
    date: Date
    eggs_produced: int = Field(..., ge=0)
    broken_eggs: int = Field(0, ge=0)

    @model_validator(mode="after")
    def broken_lte_total(self):
        if self.broken_eggs > self.eggs_produced:
            raise ValueError("broken_eggs cannot exceed eggs_produced")
        return self


class EggProductionOut(BaseModel):
    id: int
    shed_id: int
    date: Date
    eggs_produced: int
    broken_eggs: int
    usable_eggs: int
    trays: int
    eggs_per_tray: int = 30
    created_at: datetime

    model_config = {"from_attributes": True}


class FeedInventoryCreate(BaseModel):
    date: Date
    feed_received: float = Field(..., ge=0)
    feed_used: float = Field(..., ge=0)
    feed_remaining: float = Field(..., ge=0)


class FeedInventoryOut(BaseModel):
    id: int
    farm_id: int
    date: Date
    feed_received: float
    feed_used: float
    feed_remaining: float
    created_at: datetime

    model_config = {"from_attributes": True}


class FeedInventoryUpdate(BaseModel):
    date: Date | None = None
    feed_received: float | None = Field(None, ge=0)
    feed_used: float | None = Field(None, ge=0)
    feed_remaining: float | None = Field(None, ge=0)


class EggProductionPatch(BaseModel):
    shed_id: int | None = None
    date: Date | None = None
    eggs_produced: int | None = Field(None, ge=0)
    broken_eggs: int | None = Field(None, ge=0)
