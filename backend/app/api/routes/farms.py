from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from pydantic import BaseModel, EmailStr, Field

from app.api.farm_access import get_shed_for_farm, require_farm_member, require_farm_role
from app.api.pagination import LimitOffset, pagination_params
from app.database import get_db
from app.deps import ClientIp, CurrentUser
from app.models import Farm, FarmMember, Shed, User
from app.schemas.farm import (
    FarmCreate,
    FarmMemberDetailOut,
    FarmMemberRoleBody,
    FarmOut,
    FarmUpdate,
    FarmWithRoleOut,
    ShedCreate,
    ShedOut,
    ShedUpdate,
    UserSearchOut,
)
from app.schemas.pagination import Paginated
from app.services.audit_service import record_audit
from app.services.redis_events import publish_farm_event

router = APIRouter(prefix="/farms", tags=["farms"])

MANAGER_ROLES = ("owner", "manager")


class AddFarmMemberBody(BaseModel):
    email: EmailStr
    role: str = Field(..., pattern="^(owner|manager|worker)$")


@router.get("", response_model=Paginated[FarmWithRoleOut])
def list_my_farms(
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
):
    q = (
        db.query(Farm, FarmMember.role)
        .join(FarmMember, FarmMember.farm_id == Farm.id)
        .filter(FarmMember.user_id == user.id)
        .order_by(Farm.name.asc())
    )
    total = q.count()
    rows = q.offset(page.offset).limit(page.limit).all()
    items = [
        FarmWithRoleOut(
            id=farm.id,
            name=farm.name,
            location=farm.location,
            owner_id=farm.owner_id,
            created_at=farm.created_at,
            my_role=role,
        )
        for farm, role in rows
    ]
    return Paginated(items=items, total=total, limit=page.limit, offset=page.offset)


@router.post("", response_model=FarmOut)
def create_farm(
    body: FarmCreate,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    farm = Farm(name=body.name, location=body.location, owner_id=user.id)
    db.add(farm)
    db.flush()
    db.add(FarmMember(user_id=user.id, farm_id=farm.id, role="owner"))
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm.id,
        action="create",
        resource_type="farm",
        resource_id=farm.id,
        before=None,
        after={"name": farm.name, "location": farm.location},
        ip=ip,
    )
    db.commit()
    db.refresh(farm)
    publish_farm_event(farm.id, "farm_created", {"farm_id": farm.id})
    return farm


@router.get("/{farm_id}", response_model=FarmOut)
def get_farm(farm_id: int, user: CurrentUser, db: Session = Depends(get_db)):
    require_farm_member(db, user.id, farm_id)
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return farm


@router.patch("/{farm_id}", response_model=FarmOut)
def update_farm(
    farm_id: int,
    body: FarmUpdate,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    before = {"name": farm.name, "location": farm.location}
    if body.name is not None:
        farm.name = body.name
    if body.location is not None:
        farm.location = body.location
    after = {"name": farm.name, "location": farm.location}
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="update",
        resource_type="farm",
        resource_id=farm_id,
        before=before,
        after=after,
        ip=ip,
    )
    db.commit()
    db.refresh(farm)
    publish_farm_event(farm_id, "farm_updated", {"farm_id": farm_id})
    return farm


@router.get("/{farm_id}/members", response_model=Paginated[FarmMemberDetailOut])
def list_farm_members(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    q = (
        db.query(FarmMember, User)
        .join(User, User.id == FarmMember.user_id)
        .filter(FarmMember.farm_id == farm_id)
        .order_by(FarmMember.role, User.name)
    )
    total = q.count()
    rows = q.offset(page.offset).limit(page.limit).all()
    items = [
        FarmMemberDetailOut(user_id=u.id, name=u.name, email=u.email, role=m.role)
        for m, u in rows
    ]
    return Paginated(items=items, total=total, limit=page.limit, offset=page.offset)


@router.get("/{farm_id}/users/search", response_model=Paginated[UserSearchOut])
def search_users_not_in_farm(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
    q: str = "",
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    member_ids = db.query(FarmMember.user_id).filter(FarmMember.farm_id == farm_id)
    base = db.query(User).filter(~User.id.in_(member_ids))
    if q.strip():
        term = f"%{q.strip()}%"
        base = base.filter(or_(User.email.ilike(term), User.name.ilike(term)))
    total = base.count()
    users = base.order_by(User.name).offset(page.offset).limit(page.limit).all()
    items = [UserSearchOut(id=u.id, name=u.name, email=u.email) for u in users]
    return Paginated(items=items, total=total, limit=page.limit, offset=page.offset)


@router.post("/{farm_id}/sheds", response_model=ShedOut)
def create_shed(
    farm_id: int,
    body: ShedCreate,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    shed = Shed(farm_id=farm_id, name=body.name, bird_count=body.bird_count)
    db.add(shed)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="create",
        resource_type="shed",
        resource_id=shed.id,
        before=None,
        after={"name": shed.name, "bird_count": shed.bird_count},
        ip=ip,
    )
    db.commit()
    db.refresh(shed)
    publish_farm_event(farm_id, "shed_created", {"shed_id": shed.id})
    return shed


@router.get("/{farm_id}/sheds", response_model=Paginated[ShedOut])
def list_sheds(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    page: LimitOffset = Depends(pagination_params),
):
    require_farm_member(db, user.id, farm_id)
    q = db.query(Shed).filter(Shed.farm_id == farm_id).order_by(Shed.id)
    total = q.count()
    rows = q.offset(page.offset).limit(page.limit).all()
    return Paginated(
        items=rows,
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.patch("/{farm_id}/sheds/{shed_id}", response_model=ShedOut)
def update_shed(
    farm_id: int,
    shed_id: int,
    body: ShedUpdate,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    shed = get_shed_for_farm(db, shed_id, farm_id)
    before = {"name": shed.name, "bird_count": shed.bird_count}
    if body.name is not None:
        shed.name = body.name
    if body.bird_count is not None:
        shed.bird_count = body.bird_count
    after = {"name": shed.name, "bird_count": shed.bird_count}
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="update",
        resource_type="shed",
        resource_id=shed_id,
        before=before,
        after=after,
        ip=ip,
    )
    db.commit()
    db.refresh(shed)
    publish_farm_event(farm_id, "shed_updated", {"shed_id": shed.id})
    return shed


@router.delete("/{farm_id}/sheds/{shed_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shed(
    farm_id: int,
    shed_id: int,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    shed = get_shed_for_farm(db, shed_id, farm_id)
    before = {"name": shed.name, "bird_count": shed.bird_count}
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="delete",
        resource_type="shed",
        resource_id=shed_id,
        before=before,
        after=None,
        ip=ip,
    )
    db.delete(shed)
    db.commit()
    publish_farm_event(farm_id, "shed_deleted", {"shed_id": shed_id})


@router.post("/{farm_id}/members", response_model=dict)
def add_farm_member(
    farm_id: int,
    body: AddFarmMemberBody,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    target = db.query(User).filter(User.email == body.email).first()
    if not target:
        raise HTTPException(status_code=404, detail="User with this email not found")
    existing = (
        db.query(FarmMember)
        .filter(FarmMember.user_id == target.id, FarmMember.farm_id == farm_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="User already a member of this farm")
    farm_row = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm_row:
        raise HTTPException(status_code=404, detail="Farm not found")
    if body.role == "owner" and user.id != farm_row.owner_id:
        raise HTTPException(status_code=403, detail="Only farm owner can assign owner role")
    m = FarmMember(user_id=target.id, farm_id=farm_id, role=body.role)
    db.add(m)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="create",
        resource_type="farm_member",
        resource_id=target.id,
        before=None,
        after={"user_id": target.id, "email": target.email, "role": body.role},
        ip=ip,
    )
    db.commit()
    publish_farm_event(farm_id, "member_added", {"user_id": target.id, "role": body.role})
    return {"user_id": target.id, "farm_id": farm_id, "role": body.role}


class AddMemberByUserIdBody(BaseModel):
    user_id: int
    role: str = Field(..., pattern="^(owner|manager|worker)$")


@router.post("/{farm_id}/members/by-user-id", response_model=dict)
def add_farm_member_by_user_id(
    farm_id: int,
    body: AddMemberByUserIdBody,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    target = db.query(User).filter(User.id == body.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = (
        db.query(FarmMember)
        .filter(FarmMember.user_id == target.id, FarmMember.farm_id == farm_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="User already a member of this farm")
    farm_row = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm_row:
        raise HTTPException(status_code=404, detail="Farm not found")
    if body.role == "owner" and user.id != farm_row.owner_id:
        raise HTTPException(status_code=403, detail="Only farm owner can assign owner role")
    m = FarmMember(user_id=target.id, farm_id=farm_id, role=body.role)
    db.add(m)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="create",
        resource_type="farm_member",
        resource_id=target.id,
        before=None,
        after={"user_id": target.id, "email": target.email, "role": body.role},
        ip=ip,
    )
    db.commit()
    publish_farm_event(farm_id, "member_added", {"user_id": target.id, "role": body.role})
    return {"user_id": target.id, "farm_id": farm_id, "role": body.role}


@router.patch(
    "/{farm_id}/members/{member_user_id}",
    response_model=FarmMemberDetailOut,
)
def patch_farm_member_role(
    farm_id: int,
    member_user_id: int,
    body: FarmMemberRoleBody,
    user: CurrentUser,
    ip: ClientIp,
    db: Session = Depends(get_db),
):
    actor = require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    farm_row = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm_row:
        raise HTTPException(status_code=404, detail="Farm not found")
    target = (
        db.query(FarmMember)
        .filter(FarmMember.farm_id == farm_id, FarmMember.user_id == member_user_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    target_user = db.query(User).filter(User.id == member_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if target.role == "owner" and actor.role != "owner":
        raise HTTPException(
            status_code=403,
            detail="Only an owner can change another owner's role",
        )
    if body.role == "owner" and user.id != farm_row.owner_id:
        raise HTTPException(
            status_code=403,
            detail="Only farm owner can assign owner role",
        )
    if target.role == "owner" and body.role != "owner":
        owner_count = (
            db.query(FarmMember)
            .filter(FarmMember.farm_id == farm_id, FarmMember.role == "owner")
            .count()
        )
        if owner_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot demote the last owner",
            )

    before_role = target.role
    if before_role == body.role:
        return FarmMemberDetailOut(
            user_id=target_user.id,
            name=target_user.name,
            email=target_user.email,
            role=target.role,
        )

    target.role = body.role
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        farm_id=farm_id,
        action="update",
        resource_type="farm_member",
        resource_id=member_user_id,
        before={"user_id": member_user_id, "role": before_role},
        after={"user_id": member_user_id, "role": body.role},
        ip=ip,
    )
    db.commit()
    publish_farm_event(
        farm_id,
        "member_role_updated",
        {"user_id": member_user_id, "role": body.role},
    )
    return FarmMemberDetailOut(
        user_id=target_user.id,
        name=target_user.name,
        email=target_user.email,
        role=target.role,
    )
