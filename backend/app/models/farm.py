from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.production import EggProduction
    from app.models.user import User


class Farm(Base):
    __tablename__ = "farms"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str | None] = mapped_column(String(512), nullable=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    owner: Mapped["User"] = relationship("User", back_populates="owned_farms", foreign_keys=[owner_id])
    members: Mapped[list["FarmMember"]] = relationship(
        "FarmMember", back_populates="farm", cascade="all, delete-orphan"
    )
    sheds: Mapped[list["Shed"]] = relationship(
        "Shed", back_populates="farm", cascade="all, delete-orphan"
    )


class FarmMember(Base):
    __tablename__ = "farm_members"
    __table_args__ = (UniqueConstraint("user_id", "farm_id", name="uq_farm_member_user_farm"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False)  # owner | manager | worker
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="farm_memberships")
    farm: Mapped["Farm"] = relationship("Farm", back_populates="members")


class Shed(Base):
    __tablename__ = "sheds"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    bird_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    farm: Mapped["Farm"] = relationship("Farm", back_populates="sheds")
    egg_records: Mapped[list["EggProduction"]] = relationship(
        "EggProduction", back_populates="shed", cascade="all, delete-orphan"
    )
