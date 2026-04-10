import asyncio
import json
import logging

import redis.asyncio as aioredis
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.core.security import decode_token
from app.database import SessionLocal
from app.models import FarmMember

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


@router.websocket("/ws/farms/{farm_id}")
async def farm_events_ws(
    websocket: WebSocket,
    farm_id: int,
    token: str = Query(..., description="JWT access token"),
):
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        await websocket.close(code=4401)
        return
    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        m = (
            db.query(FarmMember)
            .filter(FarmMember.user_id == user_id, FarmMember.farm_id == farm_id)
            .first()
        )
        if not m:
            await websocket.close(code=4403)
            return
        if m.role == "worker":
            await websocket.close(code=4403)
            return
    finally:
        db.close()

    await websocket.accept()
    r = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = r.pubsub()
    channel = f"flockledger:farm:{farm_id}"
    await pubsub.subscribe(channel)

    async def relay():
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                data = message.get("data")
                if data:
                    await websocket.send_text(data)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.debug("pubsub relay ended: %s", e)

    task = asyncio.create_task(relay())
    try:
        while True:
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await r.aclose()
