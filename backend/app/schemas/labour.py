from datetime import date as Date
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


class FarmLabourCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    phone: str | None = Field(None, max_length=64)
    personnel_kind: str = Field(
        "labour",
        pattern="^(labour|owner_pay)$",
        description="field staff vs owner compensation line",
    )
    compensation_type: str = Field(
        "monthly",
        pattern="^(daily|monthly|hourly|adhoc)$",
    )
    default_rate: float | None = Field(None, ge=0)
    notes: str | None = None
    hired_at: Date
    linked_user_id: int | None = Field(
        None,
        description="Farm member (worker role) who may view only this labour record in the app",
    )


class FarmLabourPatch(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=255)
    phone: str | None = Field(None, max_length=64)
    personnel_kind: str | None = Field(None, pattern="^(labour|owner_pay)$")
    compensation_type: str | None = Field(None, pattern="^(daily|monthly|hourly|adhoc)$")
    default_rate: float | None = Field(None, ge=0)
    notes: str | None = None
    is_active: bool | None = None
    linked_user_id: int | None = Field(
        None,
        description="Set to null to unlink the worker app account from this row",
    )


class FarmLabourOut(BaseModel):
    id: int
    farm_id: int
    full_name: str
    phone: str | None
    personnel_kind: str
    compensation_type: str
    default_rate: float | None
    notes: str | None
    is_active: bool
    hired_at: Date
    balance_due: float
    linked_user_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class LabourLedgerCreate(BaseModel):
    line_type: str = Field(..., pattern="^(earning|payment|adjustment)$")
    amount: Decimal
    line_date: Date
    description: str | None = Field(None, max_length=512)

    @model_validator(mode="after")
    def amount_rules(self):
        if self.line_type in ("earning", "payment") and self.amount <= 0:
            raise ValueError("earning and payment amounts must be positive")
        if self.line_type == "adjustment" and self.amount == 0:
            raise ValueError("adjustment cannot be zero")
        return self


class LabourLedgerOut(BaseModel):
    id: int
    farm_id: int
    labour_id: int
    line_date: Date
    line_type: str
    amount: float
    description: str | None
    created_by_user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class LabourBalanceRow(BaseModel):
    labour_id: int
    full_name: str
    personnel_kind: str
    is_active: bool
    balance: float
