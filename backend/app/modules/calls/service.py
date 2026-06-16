import json
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from openai import AsyncOpenAI

from app.core.config import settings
from app.modules.calls.repository import CallRepository
from app.modules.calls.schema import (
    CallCounts,
    CallLabel,
    CallResponse,
    CallStatus,
    PaginatedCallsResponse,
    WebhookCallPayload,
)

logger = logging.getLogger(__name__)


class CallService:
    def __init__(self, repository: CallRepository) -> None:
        self.repository = repository

    async def list_calls(
        self,
        status: Optional[CallStatus],
        page: int,
        page_size: int,
        caller_name: Optional[str] = None,
        phone_number: Optional[str] = None,
        label: Optional[str] = None,
        min_duration: Optional[int] = None,
        max_duration: Optional[int] = None,
        sort_by: Optional[str] = None,
        sort_order: str = "desc",
    ) -> PaginatedCallsResponse:
        calls, total, total_pages, counts = await self.repository.list_calls(
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
        return PaginatedCallsResponse(
            data=[CallResponse.model_validate(c, from_attributes=True) for c in calls],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            counts=CallCounts(
                in_progress=counts.get("in_progress", 0),
                success=counts.get("success", 0),
                failed=counts.get("failed", 0),
            ),
        )

    async def get_call(self, call_id: uuid.UUID) -> CallResponse:
        call = await self.repository.get_by_id(call_id)
        if call is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        return CallResponse.model_validate(call, from_attributes=True)

    async def update_notes(self, call_id: uuid.UUID, notes: Optional[str]) -> CallResponse:
        """Task 1: Update notes on a call."""
        call = await self.repository.get_by_id(call_id)
        if call is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        call.notes = notes
        call.updated_at = datetime.utcnow()
        call = await self.repository.update(call)
        return CallResponse.model_validate(call, from_attributes=True)

    async def process_webhook(self, payload: WebhookCallPayload) -> CallResponse:
        """Task 4: Update call from webhook payload and trigger AI enrichment."""
        call = await self.repository.get_by_id(payload.call_id)
        if call is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")

        # Update fields
        call.status = payload.status
        call.updated_at = datetime.utcnow()
        if payload.duration_seconds is not None:
            call.duration_seconds = payload.duration_seconds
        if payload.raw_transcript is not None:
            call.raw_transcript = payload.raw_transcript
        if payload.ended_at is not None:
            call.ended_at = payload.ended_at

        # AI enrichment: only on terminal status with a transcript
        if payload.status in (CallStatus.success, CallStatus.failed) and payload.raw_transcript:
            try:
                summary, label = await self._enrich_with_ai(payload.raw_transcript)
                call.summary = summary
                call.label = label
            except Exception:
                logger.exception("OpenAI enrichment failed for call %s — skipping", payload.call_id)

        call = await self.repository.update(call)
        return CallResponse.model_validate(call, from_attributes=True)

    async def _enrich_with_ai(self, transcript: str) -> tuple[Optional[str], Optional[CallLabel]]:
        """Call gpt-4o-mini to generate summary and classify the call."""
        label_values = ", ".join(f'"{label.value}"' for label in CallLabel)
        client = AsyncOpenAI(api_key=settings.openai_api_key)

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a call analysis assistant. Given a call transcript, return a JSON object "
                        "with exactly two keys:\n"
                        f'- "summary": a 2-3 sentence summary of the call\n'
                        f'- "label": one of [{label_values}]\n'
                        "Return ONLY valid JSON, no markdown, no explanation."
                    ),
                },
                {"role": "user", "content": f"Transcript:\n{transcript}"},
            ],
            temperature=0,
            max_tokens=300,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content or "{}"
        parsed = json.loads(content)

        summary = parsed.get("summary")
        raw_label = parsed.get("label")

        # Validate label
        label: Optional[CallLabel] = None
        if raw_label:
            try:
                label = CallLabel(raw_label)
            except ValueError:
                logger.warning("AI returned unknown label %r — setting to None", raw_label)

        return summary, label
