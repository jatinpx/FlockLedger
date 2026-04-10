"""Persist audit rows and emit structured logs for accountability."""

from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog

logger = logging.getLogger("flockledger.audit")


def record_audit(
    db: Session,
    *,
    user_id: int,
    farm_id: int | None,
    action: str,
    resource_type: str,
    resource_id: int | None,
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
    ip: str | None,
) -> None:
    detail: dict[str, Any] = {}
    if before is not None:
        detail["before"] = before
    if after is not None:
        detail["after"] = after
    payload = json.dumps(detail, default=str) if detail else None
    row = AuditLog(
        farm_id=farm_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        detail_json=payload,
        ip_address=ip,
    )
    db.add(row)
    db.flush()
    logger.info(
        "audit action=%s resource=%s id=%s farm=%s user=%s ip=%s",
        action,
        resource_type,
        resource_id,
        farm_id,
        user_id,
        ip,
        extra={"audit_detail": detail},
    )
