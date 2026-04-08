from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AuditLogRowOut(BaseModel):
    id: int
    farm_id: int | None
    user_id: int
    user_name: str
    user_email: str
    action: str
    resource_type: str
    resource_id: int | None
    detail: dict[str, Any] | None = None
    ip_address: str | None
    created_at: datetime
