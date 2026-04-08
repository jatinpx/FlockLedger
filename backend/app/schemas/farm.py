from datetime import datetime

from pydantic import BaseModel, Field


class FarmCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    location: str | None = Field(None, max_length=512)


class FarmOut(BaseModel):
    id: int
    name: str
    location: str | None
    owner_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class FarmWithRoleOut(FarmOut):
    my_role: str


class FarmUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    location: str | None = Field(None, max_length=512)


class FarmMemberDetailOut(BaseModel):
    user_id: int
    name: str
    email: str
    role: str


class FarmMemberRoleBody(BaseModel):
    role: str = Field(..., pattern="^(owner|manager|worker)$")


class UserSearchOut(BaseModel):
    id: int
    name: str
    email: str


class ShedCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    bird_count: int = Field(..., ge=0)


class ShedUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    bird_count: int | None = Field(None, ge=0)


class ShedOut(BaseModel):
    id: int
    farm_id: int
    name: str
    bird_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class FarmMemberOut(BaseModel):
    user_id: int
    farm_id: int
    role: str

    model_config = {"from_attributes": True}
