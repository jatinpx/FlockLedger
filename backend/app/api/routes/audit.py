import json
from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.analytics_params import list_optional_date_range
from app.api.farm_access import require_farm_role
from app.api.pagination import LimitOffset, pagination_params
from app.database import get_db
from app.deps import CurrentUser
from app.models import AuditLog, User
from app.schemas.audit import AuditLogRowOut
from app.schemas.pagination import Paginated

router = APIRouter(prefix="/farms/{farm_id}/audit-logs", tags=["audit"])

MANAGER_ROLES = ("owner", "manager")


@router.get("", response_model=Paginated[AuditLogRowOut])
def list_farm_audit_logs(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
    dr: tuple = Depends(list_optional_date_range),
):
    """Owners and managers can review mutation history for accountability."""
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    start_date, end_date = dr
    q = (
        db.query(AuditLog, User.name, User.email)
        .join(User, User.id == AuditLog.user_id)
        .filter(AuditLog.farm_id == farm_id)
    )
    if start_date is not None:
        q = q.filter(
            AuditLog.created_at
            >= datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        )
    if end_date is not None:
        q = q.filter(
            AuditLog.created_at
            <= datetime.combine(end_date, time(23, 59, 59, 999999), tzinfo=timezone.utc)
        )
    q = q.order_by(AuditLog.id.desc())
    total = q.count()
    rows = q.offset(page.offset).limit(page.limit).all()
    out: list[AuditLogRowOut] = []
    for log, uname, uemail in rows:
        detail = None
        if log.detail_json:
            try:
                detail = json.loads(log.detail_json)
            except json.JSONDecodeError:
                detail = {"raw": log.detail_json}
        out.append(
            AuditLogRowOut(
                id=log.id,
                farm_id=log.farm_id,
                user_id=log.user_id,
                user_name=uname,
                user_email=uemail,
                action=log.action,
                resource_type=log.resource_type,
                resource_id=log.resource_id,
                detail=detail,
                ip_address=log.ip_address,
                created_at=log.created_at,
            )
        )
    return Paginated(items=out, total=total, limit=page.limit, offset=page.offset)
