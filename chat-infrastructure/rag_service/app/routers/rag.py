from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException

from ..schemas import HealthResponse, IngestRequest, RagQueryRequest, RagQueryResponse
from ..services.cache import clear_cached_answers, get_client as get_redis_client
from ..services.ingest import ingest_documents
from ..services.query import answer_question
from ..services.vectorstore import get_client as get_qdrant_client
from ..config import get_settings

router = APIRouter(prefix="/rag", tags=["RAG"])


def require_admin_key(x_rag_admin_key: str | None = Header(default=None)) -> None:
    settings = get_settings()
    key = settings.admin_api_key.strip()
    if key and x_rag_admin_key != key:
        raise HTTPException(status_code=401, detail="Missing or invalid admin key")


@router.post("/ingest", dependencies=[Depends(require_admin_key)])
async def ingest(request: IngestRequest) -> dict[str, Any]:
    inserted = await ingest_documents(request)
    return {"ingested_chunks": inserted}


@router.post("/query", response_model=RagQueryResponse)
async def query(request: RagQueryRequest) -> RagQueryResponse:
    answer, sources, cached = await answer_question(request)
    return RagQueryResponse(answer=answer, sources=sources, cached=cached)


@router.post("/cache/flush", dependencies=[Depends(require_admin_key)])
async def flush_cache() -> dict[str, Any]:
    deleted = await clear_cached_answers()
    return {"deleted": deleted}


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    qdrant_status = "ok"
    redis_status = "ok"
    try:
        client = get_qdrant_client()
        client.get_collections()
    except Exception as exc:  # pragma: no cover
        qdrant_status = f"error: {exc}"

    try:
        redis = get_redis_client()
        await redis.ping()
    except Exception as exc:  # pragma: no cover
        redis_status = f"error: {exc}"

    return HealthResponse(service="ok", qdrant=qdrant_status, redis=redis_status)
