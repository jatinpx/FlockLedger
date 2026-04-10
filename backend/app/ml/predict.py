from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import EggProduction, FeedInventory, Shed
from app.services.analytics_service import daily_egg_series, feed_series


def load_model_bundle(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        import joblib

        return joblib.load(path)
    except Exception:
        return None


def _bird_stats(db: Session, farm_id: int) -> tuple[float, float]:
    n = (
        db.query(func.count(Shed.id), func.coalesce(func.sum(Shed.bird_count), 0))
        .filter(Shed.farm_id == farm_id)
        .one()
    )
    shed_count = float(n[0] or 0)
    birds = float(n[1] or 0)
    return shed_count, birds


def build_egg_features(db: Session, farm_id: int) -> np.ndarray | None:
    series = daily_egg_series(db, farm_id, 14)
    if not series:
        return None
    usable = [d["usable_eggs"] for d in series]
    if len(usable) < 7:
        return None
    last7 = usable[-7:]
    prev7 = usable[-14:-7] if len(usable) >= 14 else usable[:7]
    mean_last = float(np.mean(last7))
    mean_prev = float(np.mean(prev7)) if prev7 else mean_last
    _, birds = _bird_stats(db, farm_id)
    feed_rows = (
        db.query(FeedInventory)
        .filter(FeedInventory.farm_id == farm_id)
        .order_by(FeedInventory.date.desc())
        .limit(7)
        .all()
    )
    feed_used = float(np.mean([float(r.feed_used) for r in feed_rows])) if feed_rows else 0.0
    return np.array(
        [[mean_last, mean_prev, birds, feed_used, float(np.std(last7))]],
        dtype=np.float64,
    )


def predict_egg_week(db: Session, farm_id: int, bundle: dict[str, Any]) -> float | None:
    X = build_egg_features(db, farm_id)
    if X is None:
        return None
    model = bundle.get("model")
    if model is None:
        return None
    pred = model.predict(X)
    return float(max(0.0, pred[0]))


def build_feed_features(db: Session, farm_id: int) -> np.ndarray | None:
    """Must match feature_cols in scripts/train_models.train_feed."""
    series = feed_series(db, farm_id, 30)
    if len(series) < 15:
        return None
    used = [d["feed_used"] for d in series]
    window = used[-14:]
    mean_u = float(np.mean(window))
    std_u = float(np.std(window))
    return np.array([[mean_u, std_u]], dtype=np.float64)


def predict_feed_days(
    db: Session, farm_id: int, horizon_days: int, bundle: dict[str, Any]
) -> float | None:
    X = build_feed_features(db, farm_id)
    if X is None:
        return None
    model = bundle.get("model")
    if model is None:
        return None
    daily = float(max(0.0, model.predict(X)[0]))
    return daily * horizon_days
