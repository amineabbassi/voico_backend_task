import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.modules.calls.router import router as calls_router
from app.modules.calls.tasks import run_stale_call_expiry_loop

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(
    title=settings.app_name,
    description="Backend API for the Voico Calls Dashboard",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(calls_router, prefix="/api")


@app.on_event("startup")
async def startup_event() -> None:
    """Task 3: Start the stale call expiry background loop on server startup."""
    asyncio.create_task(run_stale_call_expiry_loop())


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok", "service": settings.app_name}
