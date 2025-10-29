from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query

from ..schemas import ClarificationRecord, ClarificationResponse
from ..services.database import maybe_parse_json, run_clarification_query
from .dependencies import require_admin_key

router = APIRouter(prefix="/analytics", tags=["Analytics"], dependencies=[Depends(require_admin_key)])


@router.get("/menu-query/clarifications", response_model=ClarificationResponse)
async def list_menu_query_clarifications(
    limit: int = Query(default=200, ge=1, le=2000),
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
) -> ClarificationResponse:
    result = run_clarification_query(limit=limit, start_at=start_at, end_at=end_at)

    records: list[ClarificationRecord] = []
    for row in result:
        payload: dict[str, Any] = dict(row)
        payload["tokens"] = maybe_parse_json(payload.get("tokens"))
        payload["intents"] = maybe_parse_json(payload.get("intents"))
        payload["query_metadata"] = maybe_parse_json(payload.get("query_metadata"))
        payload["clarification_metadata"] = maybe_parse_json(payload.get("clarification_metadata"))
        records.append(ClarificationRecord.model_validate(payload))

    return ClarificationResponse(count=len(records), items=records)
