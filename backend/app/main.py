import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(name)s %(message)s",
)
logging.getLogger("flockledger.audit").setLevel(logging.INFO)

from app.api.routes import (
    analytics,
    audit,
    auth,
    expenses,
    farms,
    feed,
    flock,
    labour,
    ml,
    production,
    sales,
    websocket,
)
from app.core.config import settings
from app.migrations_runner import run_migrations_if_enabled


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Avoid blocking the event loop during migrate; subprocess is sync.
    await asyncio.to_thread(run_migrations_if_enabled)
    yield


app = FastAPI(title="FlockLedger API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(farms.router)
app.include_router(audit.router)
app.include_router(production.router)
app.include_router(feed.router)
app.include_router(labour.router)
app.include_router(flock.router)
app.include_router(sales.router)
app.include_router(expenses.router)
app.include_router(analytics.router)
app.include_router(ml.router)
app.include_router(websocket.router)


@app.get("/health")
def health():
    return {"status": "ok"}
