from datetime import date as Date
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class FlockEventCreate(BaseModel):
    shed_id: int
    event_date: Date
    event_kind: str = Field(
        ...,
        pattern="^(mortality|cull|live_sale|transfer_out|purchase|transfer_in|count_adjust)$",
    )
    quantity: int = Field(..., description="Positive for in/out kinds; signed for count_adjust")
    note: str | None = None

    @model_validator(mode="after")
    def quantity_matches_kind(self):
        if self.event_kind != "count_adjust" and self.quantity <= 0:
            raise ValueError("quantity must be positive for this event kind")
        if self.event_kind == "count_adjust" and self.quantity == 0:
            raise ValueError("count_adjust quantity cannot be zero")
        return self


class FlockEventOut(BaseModel):
    id: int
    farm_id: int
    shed_id: int
    event_date: Date
    event_kind: str
    quantity: int
    birds_delta: int
    note: str | None
    created_by_user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class FlockSummary(BaseModel):
    birds_alive_total: int
    by_kind: dict[str, int]
    by_shed: list[dict]
