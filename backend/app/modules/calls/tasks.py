"""Background tasks for the calls module."""
import asyncio
import logging
from datetime import datetime, timedelta

from app.core.config import settings
from app.core.db import async_session
from app.modules.calls.repository import CallRepository

logger = logging.getLogger(__name__)


async def expire_stale_calls() -> None:
    """Mark in_progress calls older than STALE_CALL_THRESHOLD_MINUTES as failed."""
    stale_before = datetime.utcnow() - timedelta(minutes=settings.stale_call_threshold_minutes)
    async with async_session() as session:
        async with session.begin():
            repo = CallRepository(session)
            count = await repo.expire_stale_calls(stale_before)
            if count:
                logger.info("Expired %d stale call(s) (threshold: %d min)", count, settings.stale_call_threshold_minutes)
            else:
                logger.info("No stale calls to expire.")


async def run_stale_call_expiry_loop() -> None:
    """Runs the stale call expiry job on a configurable interval."""
    interval_seconds = settings.stale_call_check_interval_minutes * 60
    logger.info(
        "Stale call expiry task started — interval: %d min, threshold: %d min",
        settings.stale_call_check_interval_minutes,
        settings.stale_call_threshold_minutes,
    )
    while True:
        try:
            await expire_stale_calls()
        except Exception:
            logger.exception("Error in stale call expiry task")
        await asyncio.sleep(interval_seconds)
