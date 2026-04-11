"""Build training matrices from the database (used by scripts/train_models.py)."""

from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.models import FeedInventory, Shed
from app.services.analytics_service import daily_egg_series, feed_series
from sqlalchemy import func


def export_egg_training_rows(db: Session, farm_id: int) -> pd.DataFrame | None:
    """Each row: features from days t-14..t-1, target = sum usable eggs t..t+6."""
    series = daily_egg_series(db, farm_id, 120)
    if len(series) < 21:
        return None
    usable = [d["usable_eggs"] for d in series]
    dates = [date.fromisoformat(d["date"]) for d in series]
    _, birds = (
        db.query(func.coalesce(func.sum(Shed.bird_count), 0))
        .filter(Shed.farm_id == farm_id)
        .one()
    )
    birds_f = float(birds or 0)
    rows = []
    for i in range(14, len(usable) - 7):
        last7 = usable[i - 7 : i]
        prev7 = usable[i - 14 : i - 7]
        target = sum(usable[i : i + 7])
        feed_used_mean = 0.0
        fi = (
            db.query(FeedInventory)
            .filter(
                FeedInventory.farm_id == farm_id,
                FeedInventory.date <= dates[i],
            )
            .order_by(FeedInventory.date.desc())
            .limit(7)
            .all()
        )
        if fi:
            feed_used_mean = float(np.mean([float(x.feed_used) for x in fi]))
        rows.append(
            {
                "mean_last7": float(np.mean(last7)),
                "mean_prev7": float(np.mean(prev7)),
                "birds": birds_f,
                "feed_used_mean": feed_used_mean,
                "std_last7": float(np.std(last7)),
                "target_next7_usable": float(target),
            }
        )
    return pd.DataFrame(rows)


def export_feed_training_rows(db: Session, farm_id: int) -> pd.DataFrame | None:
    series = feed_series(db, farm_id, 120)
    if len(series) < 21:
        return None
    used = [d["feed_used"] for d in series]
    rows = []
    for i in range(14, len(used) - 1):
        window = used[i - 14 : i]
        target = used[i]
        rows.append(
            {
                "mean_used_14": float(np.mean(window)),
                "std_used_14": float(np.std(window)),
                "target_day_used": float(target),
            }
        )
    return pd.DataFrame(rows)
