from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from ..schemas import (
    EmbedRequest,
    EmbedResponse,
    HealthResponse,
    IngestRequest,
    RagQueryRequest,
    RagQueryResponse,
)
from ..services.cache import clear_cached_answers, get_client as get_redis_client
from ..services.embedding import embed_texts
from ..services.ingest import ingest_documents
from ..services.query import answer_question
from ..services.vectorstore import get_client as get_qdrant_client
from .dependencies import require_admin_key

router = APIRouter(prefix="/rag", tags=["RAG"])


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


@router.post("/embed", dependencies=[Depends(require_admin_key)], response_model=EmbedResponse)
async def embed(request: EmbedRequest) -> EmbedResponse:
    embeddings = await embed_texts(request.texts)
    return EmbedResponse(embeddings=embeddings)


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
