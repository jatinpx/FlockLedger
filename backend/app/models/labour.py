import datetime as dt
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.production import Expense


class FarmLabour(Base):
    """On-farm worker or owner compensation line (not the same as app User accounts)."""

    __tablename__ = "farm_labour"
    __table_args__ = (
        UniqueConstraint("farm_id", "linked_user_id", name="uq_farm_labour_farm_linked_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id"), nullable=False, index=True)
    linked_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    personnel_kind: Mapped[str] = mapped_column(
        String(32), nullable=False, default="labour"
    )  # labour | owner_pay
    compensation_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="monthly"
    )  # daily | monthly | hourly | adhoc
    default_rate: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    hired_at: Mapped[dt.date] = mapped_column(Date, nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    farm: Mapped["Farm"] = relationship("Farm", back_populates="labour")
    ledger_lines: Mapped[list["LabourLedgerLine"]] = relationship(
        "LabourLedgerLine", cascade="all, delete-orphan", back_populates="labour"
    )


class LabourLedgerLine(Base):
    """earning = farm owes more; payment = farm paid labour; adjustment = signed correction."""

    __tablename__ = "labour_ledger_lines"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id"), nullable=False, index=True)
    labour_id: Mapped[int] = mapped_column(ForeignKey("farm_labour.id"), nullable=False, index=True)
    line_date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    line_type: Mapped[str] = mapped_column(String(32), nullable=False)
    # earning, payment, adjustment
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    labour: Mapped["FarmLabour"] = relationship("FarmLabour", back_populates="ledger_lines")
