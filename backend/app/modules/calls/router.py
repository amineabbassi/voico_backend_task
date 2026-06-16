import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.db import async_session
from app.core.decorators import session_manager
from app.modules.calls.repository import CallRepository
from app.modules.calls.schema import (
    CallResponse,
    CallStatus,
    PaginatedCallsResponse,
    UpdateNotesPayload,
    WebhookCallPayload,
)
from app.modules.calls.service import CallService

router = APIRouter()


async def get_session():
    async with async_session() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_call_service(session: SessionDep) -> CallService:
    return CallService(CallRepository(session))


@router.get("/calls", response_model=PaginatedCallsResponse)
async def list_calls(
    session: SessionDep,
    service: Annotated[CallService, Depends(get_call_service)],
    status: Optional[CallStatus] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    # Task 2: advanced filters
    caller_name: Optional[str] = Query(default=None, description="Partial match on caller name"),
    phone_number: Optional[str] = Query(default=None, description="Partial match on phone number"),
    label: Optional[str] = Query(default=None, description="Exact match on label"),
    min_duration: Optional[int] = Query(default=None, description="Minimum duration in seconds"),
    max_duration: Optional[int] = Query(default=None, description="Maximum duration in seconds"),
    sort_by: Optional[str] = Query(default=None, description="Column to sort by"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
) -> PaginatedCallsResponse:
    return await service.list_calls(
        status=status,
        page=page,
        page_size=page_size,
        caller_name=caller_name,
        phone_number=phone_number,
        label=label,
        min_duration=min_duration,
        max_duration=max_duration,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/calls/{call_id}", response_model=CallResponse)
async def get_call(
    call_id: uuid.UUID,
    session: SessionDep,
    service: Annotated[CallService, Depends(get_call_service)],
) -> CallResponse:
    return await service.get_call(call_id)


@router.patch("/calls/{call_id}/notes", response_model=CallResponse)
@session_manager
async def update_call_notes(
    call_id: uuid.UUID,
    payload: UpdateNotesPayload,
    session: SessionDep,
    service: Annotated[CallService, Depends(get_call_service)],
) -> CallResponse:
    """Task 1: Update notes on a call."""
    return await service.update_notes(call_id, payload.notes)


@router.post("/webhook/call", response_model=CallResponse)
@session_manager
async def webhook_call(
    payload: WebhookCallPayload,
    session: SessionDep,
    service: Annotated[CallService, Depends(get_call_service)],
) -> CallResponse:
    """Task 4: Process incoming call webhook and enrich with AI."""
    return await service.process_webhook(payload)
