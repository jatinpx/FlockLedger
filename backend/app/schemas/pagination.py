from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class Paginated(BaseModel, Generic[T]):
    items: list[T] = Field(default_factory=list)
    total: int
    limit: int
    offset: int
