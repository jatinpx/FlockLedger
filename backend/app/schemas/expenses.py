from datetime import date as Date
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.constants.expense_categories import (
    LABOUR_WAGES_CATEGORY,
    is_allowed_category,
    is_miscellaneous,
)


class ExpenseCreate(BaseModel):
    category: str = Field(..., min_length=1, max_length=128)
    amount: Decimal = Field(..., ge=0)
    description: str | None = None
    date: Date
    labour_ledger_line_id: int | None = Field(
        None,
        description="Link to an existing labour payment line (category must be Labour & wages).",
    )
    feed_inventory_id: int | None = Field(
        None,
        description="Link to a feed inventory row (category must be Feed & fodder).",
    )
    labour_id: int | None = Field(
        None,
        description=(
            "When category is Labour & wages: create a labour payment for this person "
            "and link this expense (updates their balance). Mutually exclusive with labour_ledger_line_id."
        ),
    )

    @field_validator("category")
    @classmethod
    def category_must_be_predefined(cls, v: str) -> str:
        s = v.strip()
        if not is_allowed_category(s):
            raise ValueError(
                "category must be one of the predefined farm expense categories"
            )
        return s

    @field_validator("date")
    @classmethod
    def date_cannot_be_future(cls, v: Date) -> Date:
        if v > Date.today():
            raise ValueError("date cannot be in the future")
        return v

    @model_validator(mode="after")
    def miscellaneous_requires_description(self):
        if is_miscellaneous(self.category):
            if self.description is None or not str(self.description).strip():
                raise ValueError(
                    "description is required when category is Miscellaneous"
                )
        return self

    @model_validator(mode="after")
    def at_most_one_operational_link(self):
        if self.labour_ledger_line_id is not None and self.feed_inventory_id is not None:
            raise ValueError("link at most one of labour_ledger_line_id or feed_inventory_id")
        if self.labour_id is not None and (
            self.labour_ledger_line_id is not None or self.feed_inventory_id is not None
        ):
            raise ValueError(
                "use labour_id by itself, or labour_ledger_line_id / feed_inventory_id — not together"
            )
        if self.labour_id is not None and self.category.strip() != LABOUR_WAGES_CATEGORY:
            raise ValueError(f"labour_id is only valid when category is {LABOUR_WAGES_CATEGORY!r}")
        return self


class ExpenseOut(BaseModel):
    id: int
    farm_id: int
    category: str
    amount: float
    description: str | None
    date: Date
    created_at: datetime
    labour_ledger_line_id: int | None = None
    feed_inventory_id: int | None = None
    linked_labour_id: int | None = None
    linked_labour_name: str | None = None

    model_config = {"from_attributes": True}


class ExpenseUpdate(BaseModel):
    category: str | None = Field(None, min_length=1, max_length=128)
    amount: Decimal | None = Field(None, ge=0)
    description: str | None = None
    date: Date | None = None

    @field_validator("category")
    @classmethod
    def category_must_be_predefined(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        if not is_allowed_category(s):
            raise ValueError(
                "category must be one of the predefined farm expense categories"
            )
        return s
    @field_validator("date")
    @classmethod
    def date_cannot_be_future(cls, v: Date | None) -> Date | None:
        if v is not None and v > Date.today():
            raise ValueError("date cannot be in the future")
        return v