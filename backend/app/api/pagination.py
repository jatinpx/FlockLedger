from dataclasses import dataclass

from fastapi import Query

DEFAULT_LIMIT = 25
MAX_LIMIT = 500


@dataclass(frozen=True)
class LimitOffset:
    limit: int
    offset: int


def pagination_params(
    limit: int = Query(
        DEFAULT_LIMIT,
        ge=1,
        le=MAX_LIMIT,
        description="Page size (1–500)",
    ),
    offset: int = Query(0, ge=0, description="Rows to skip"),
) -> LimitOffset:
    return LimitOffset(limit=limit, offset=offset)
