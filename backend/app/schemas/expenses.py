from datetime import date as Date
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.constants.expense_categories import is_allowed_category, is_miscellaneous


class ExpenseCreate(BaseModel):
    category: str = Field(..., min_length=1, max_length=128)
    amount: Decimal = Field(..., ge=0)
    description: str | None = None
    date: Date

    @field_validator("category")
    @classmethod
    def category_must_be_predefined(cls, v: str) -> str:
        s = v.strip()
        if not is_allowed_category(s):
            raise ValueError(
                "category must be one of the predefined farm expense categories"
            )
        return s

    @model_validator(mode="after")
    def miscellaneous_requires_description(self):
        if is_miscellaneous(self.category):
            if self.description is None or not str(self.description).strip():
                raise ValueError(
                    "description is required when category is Miscellaneous"
                )
        return self


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
