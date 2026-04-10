"""Predefined poultry / farm expense categories (stored verbatim on expense rows)."""

MISCELLANEOUS_CATEGORY = "Miscellaneous"

# Used when linking labour payments and feed entries to the expense log / P&L.
LABOUR_WAGES_CATEGORY = "Labour & wages"
FEED_FODDER_CATEGORY = "Feed & fodder"

# Order: typical frequency / grouping; "Miscellaneous" last in UI.
EXPENSE_CATEGORIES: tuple[str, ...] = (
    "Feed & fodder",
    "Supplements & minerals",
    "Veterinary & medicine",
    "Chicks & hatchery",
    "Housing & equipment",
    "Utilities",
    "Fuel & transport",
    "Labour & wages",
    "Insurance & compliance",
    "Marketing & packaging",
    "Rent & land",
    "Biosecurity & sanitation",
    "Repairs & maintenance",
    "Finance & bank charges",
    "Professional services",
    "Taxes & government fees",
    "Miscellaneous",
)

_EXPENSE_SET = frozenset(EXPENSE_CATEGORIES)


def is_allowed_category(value: str) -> bool:
    return value.strip() in _EXPENSE_SET


def is_miscellaneous(value: str) -> bool:
    return value.strip() == MISCELLANEOUS_CATEGORY


def misc_requires_description(category: str, description: str | None) -> bool:
    if not is_miscellaneous(category):
        return False
    return description is None or not str(description).strip()
