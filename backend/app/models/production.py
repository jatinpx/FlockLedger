import datetime as dt
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.farm import Shed


class EggProduction(Base):
    __tablename__ = "egg_production"
    __table_args__ = (UniqueConstraint("shed_id", "date", name="uq_egg_production_shed_date"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    shed_id: Mapped[int] = mapped_column(ForeignKey("sheds.id"), nullable=False, index=True)
    date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    eggs_produced: Mapped[int] = mapped_column(Integer, nullable=False)
    broken_eggs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    shed: Mapped["Shed"] = relationship("Shed", back_populates="egg_records")


class FeedInventory(Base):
    __tablename__ = "feed_inventory"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id"), nullable=False, index=True)
    feed_received: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    feed_used: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    feed_remaining: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id"), nullable=False, index=True)
    buyer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    trays_sold: Mapped[int] = mapped_column(Integer, nullable=False)
    rate_per_tray: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id"), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(128), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
