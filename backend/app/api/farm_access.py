from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import FarmMember, Shed


def require_farm_member(db: Session, user_id: int, farm_id: int) -> FarmMember:
    m = (
        db.query(FarmMember)
        .filter(FarmMember.user_id == user_id, FarmMember.farm_id == farm_id)
        .first()
    )
    if not m:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to this farm",
        )
    return m


def require_farm_role(
    db: Session, user_id: int, farm_id: int, *allowed: str
) -> FarmMember:
    m = require_farm_member(db, user_id, farm_id)
    if allowed and m.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return m


def get_shed_for_farm(db: Session, shed_id: int, farm_id: int) -> Shed:
    shed = db.query(Shed).filter(Shed.id == shed_id, Shed.farm_id == farm_id).first()
    if not shed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shed not found")
    return shed
