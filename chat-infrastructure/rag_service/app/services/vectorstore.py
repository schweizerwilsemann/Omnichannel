from __future__ import annotations

import asyncio
from typing import Any, Dict, Iterable, List, Optional, Sequence
from uuid import uuid4

from qdrant_client import QdrantClient
from qdrant_client.http import models as qm

from ..config import get_settings

_client: QdrantClient | None = None


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
    return _client


async def ensure_collection(vector_size: int) -> None:
    settings = get_settings()
    client = get_client()

    def _ensure() -> None:
        try:
            client.get_collection(settings.qdrant_collection)
        except Exception:
            client.recreate_collection(
                collection_name=settings.qdrant_collection,
                vectors_config=qm.VectorParams(size=vector_size, distance=qm.Distance.COSINE),
            )

    await asyncio.to_thread(_ensure)


async def upsert_embeddings(embeddings: Sequence[Sequence[float]], payloads: Sequence[Dict[str, Any]]) -> None:
    settings = get_settings()
    client = get_client()

    def _upsert() -> None:
        points = [
            qm.PointStruct(id=str(uuid4()), vector=embedding, payload=payload)
            for embedding, payload in zip(embeddings, payloads, strict=True)
        ]
        client.upsert(collection_name=settings.qdrant_collection, points=points)

    await asyncio.to_thread(_upsert)


async def search(embedding: Sequence[float], limit: int, flt: Optional[qm.Filter] = None) -> List[qm.ScoredPoint]:
    settings = get_settings()
    client = get_client()

    def _search() -> List[qm.ScoredPoint]:
        return client.search(
            collection_name=settings.qdrant_collection,
            query_vector=list(embedding),
            limit=limit,
            with_payload=True,
            query_filter=flt,
        )

    return await asyncio.to_thread(_search)
