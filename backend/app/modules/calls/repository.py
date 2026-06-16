import math
import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import col, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.modules.calls.schema import Call, CallStatus


class CallRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, call_id: uuid.UUID) -> Optional[Call]:
        result = await self.session.exec(select(Call).where(Call.id == call_id))
        return result.first()

    async def list_calls(
        self,
        status: Optional[CallStatus],
        page: int,
        page_size: int,
        # Task 2: advanced filters
        caller_name: Optional[str] = None,
        phone_number: Optional[str] = None,
        label: Optional[str] = None,
        min_duration: Optional[int] = None,
        max_duration: Optional[int] = None,
        sort_by: Optional[str] = None,
        sort_order: str = "desc",
    ) -> tuple[list[Call], int, int, dict[str, int]]:
        query = select(Call)
        count_query = select(func.count()).select_from(Call)

        # Build filters
        filters = []
        if status is not None:
            filters.append(Call.status == status)
        if caller_name is not None:
            filters.append(col(Call.caller_name).ilike(f"%{caller_name}%"))
        if phone_number is not None:
            filters.append(col(Call.phone_number).ilike(f"%{phone_number}%"))
        if label is not None:
            filters.append(Call.label == label)
        if min_duration is not None:
            filters.append(Call.duration_seconds >= min_duration)
        if max_duration is not None:
            filters.append(Call.duration_seconds <= max_duration)

        for f in filters:
            query = query.where(f)
            count_query = count_query.where(f)

        # Counts per status (always unfiltered by status)
        counts: dict[str, int] = {}
        for s in CallStatus:
            c = (
                await self.session.exec(
                    select(func.count()).select_from(Call).where(Call.status == s)
                )
            ).one()
            counts[s.value] = c

        count_result = await self.session.exec(count_query)
        total = count_result.one()

        # Sorting
        sortable_columns = {
            "started_at": Call.started_at,
            "ended_at": Call.ended_at,
            "duration_seconds": Call.duration_seconds,
            "caller_name": Call.caller_name,
            "phone_number": Call.phone_number,
            "status": Call.status,
            "created_at": Call.created_at,
        }
        sort_col = sortable_columns.get(sort_by or "created_at", Call.created_at)
        if sort_order == "asc":
            query = query.order_by(col(sort_col).asc())  # type: ignore[arg-type]
        else:
            query = query.order_by(col(sort_col).desc())  # type: ignore[arg-type]

        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        result = await self.session.exec(query)
        calls = list(result.all())

        total_pages = math.ceil(total / page_size) if total > 0 else 1
        return calls, total, total_pages, counts

    async def update(self, call: Call) -> Call:
        self.session.add(call)
        await self.session.flush()
        await self.session.refresh(call)
        return call

    async def expire_stale_calls(self, stale_before: datetime) -> int:
        """Task 3: Batch-update in_progress calls older than stale_before to failed."""
        result = await self.session.exec(
            select(Call).where(
                Call.status == CallStatus.in_progress,
                Call.started_at < stale_before,
            )
        )
        stale_calls = list(result.all())
        now = datetime.utcnow()
        for call in stale_calls:
            call.status = CallStatus.failed
            call.updated_at = now
            self.session.add(call)
        await self.session.flush()
        return len(stale_calls)
