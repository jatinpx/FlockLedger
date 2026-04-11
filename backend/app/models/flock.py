import datetime as dt

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FlockEvent(Base):
    """Bird movements; shed.bird_count is updated to match."""

    __tablename__ = "flock_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id"), nullable=False, index=True)
    shed_id: Mapped[int] = mapped_column(ForeignKey("sheds.id"), nullable=False, index=True)
    event_date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    event_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    # mortality, cull, live_sale, transfer_out, purchase, transfer_in, count_adjust
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
