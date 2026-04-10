"""ML prediction endpoints (XGBoost when a trained model exists)."""

from pathlib import Path

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.farm_access import require_farm_role
from app.database import get_db
from app.deps import CurrentUser
from app.ml.predict import load_model_bundle, predict_egg_week, predict_feed_days

router = APIRouter(prefix="/farms/{farm_id}/ml", tags=["ml"])

MANAGER_ROLES = ("owner", "manager")

MODEL_DIR = Path(__file__).resolve().parents[3] / "ml_artifacts"


@router.get("/predict/eggs-next-week")
def predict_eggs(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    bundle = load_model_bundle(MODEL_DIR / "egg_model.joblib")
    if bundle is None:
        return {
            "model_loaded": False,
            "message": "Train a model with scripts/train_models.py and save to ml_artifacts/egg_model.joblib",
            "predicted_usable_eggs_next_7d": None,
        }
    pred = predict_egg_week(db, farm_id, bundle)
    return {"model_loaded": True, "predicted_usable_eggs_next_7d": pred}


@router.get("/predict/feed-next-days")
def predict_feed(
    farm_id: int,
    user: CurrentUser,
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=90),
):
    require_farm_role(db, user.id, farm_id, *MANAGER_ROLES)
    bundle = load_model_bundle(MODEL_DIR / "feed_model.joblib")
    if bundle is None:
        return {
            "model_loaded": False,
            "message": "Train a model with scripts/train_models.py and save to ml_artifacts/feed_model.joblib",
            "predicted_feed_kg": None,
        }
    pred = predict_feed_days(db, farm_id, days, bundle)
    return {"model_loaded": True, "horizon_days": days, "predicted_feed_kg": pred}
