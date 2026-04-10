import json
import logging

import redis

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(settings.redis_url, decode_responses=True)
    return _client


def publish_farm_event(farm_id: int, event_type: str, payload: dict) -> None:
    try:
        r = get_redis()
        message = json.dumps({"type": event_type, "farm_id": farm_id, **payload})
        r.publish(f"flockledger:farm:{farm_id}", message)
    except Exception as e:
        logger.warning("Redis publish failed: %s", e)
