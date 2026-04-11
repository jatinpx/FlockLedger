"""
Train XGBoost models from PostgreSQL data and save to ml_artifacts/.

Usage (from backend/ with DATABASE_URL set):
  python -m scripts.train_models
"""
from __future__ import annotations

import os
from pathlib import Path

import joblib
import pandas as pd
from sqlalchemy.orm import Session
from xgboost import XGBRegressor

from app.database import SessionLocal
from app.ml.features_export import export_egg_training_rows, export_feed_training_rows
from app.models import Farm

ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "ml_artifacts"


def train_egg(db: Session) -> None:
    frames = []
    for farm in db.query(Farm).all():
        df = export_egg_training_rows(db, farm.id)
        if df is not None and len(df) > 10:
            frames.append(df)
    if not frames:
        print("Not enough egg history to train egg model.")
        return
    data = pd.concat(frames, ignore_index=True)
    feature_cols = ["mean_last7", "mean_prev7", "birds", "feed_used_mean", "std_last7"]
    X = data[feature_cols].values
    y = data["target_next7_usable"].values
    model = XGBRegressor(
        n_estimators=80,
        max_depth=4,
        learning_rate=0.08,
        random_state=42,
    )
    model.fit(X, y)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "feature_cols": feature_cols}, ARTIFACT_DIR / "egg_model.joblib")
    print(f"Saved egg model, rows={len(data)}")


def train_feed(db: Session) -> None:
    frames = []
    for farm in db.query(Farm).all():
        df = export_feed_training_rows(db, farm.id)
        if df is not None and len(df) > 10:
            frames.append(df)
    if not frames:
        print("Not enough feed history to train feed model.")
        return
    data = pd.concat(frames, ignore_index=True)
    feature_cols = ["mean_used_14", "std_used_14"]
    X = data[feature_cols].values
    y = data["target_day_used"].values
    model = XGBRegressor(
        n_estimators=60,
        max_depth=3,
        learning_rate=0.1,
        random_state=42,
    )
    model.fit(X, y)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "feature_cols": feature_cols}, ARTIFACT_DIR / "feed_model.joblib")
    print(f"Saved feed model, rows={len(data)}")


def main() -> None:
    os.environ.setdefault("DATABASE_URL", "postgresql://flock:flock@localhost:5432/flockledger")
    db = SessionLocal()
    try:
        train_egg(db)
        train_feed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
