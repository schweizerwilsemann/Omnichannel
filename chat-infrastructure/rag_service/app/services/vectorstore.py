from __future__ import annotations

import asyncio
import hashlib
from typing import Any, Dict, Iterable, List, Optional, Sequence
from uuid import UUID, uuid4

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
                vectors_config=qm.VectorParams(
                    size=vector_size, distance=qm.Distance.COSINE
                ),
            )

    await asyncio.to_thread(_ensure)


async def upsert_embeddings(
    embeddings: Sequence[Sequence[float]], payloads: Sequence[Dict[str, Any]]
) -> None:
    settings = get_settings()
    client = get_client()

    def _upsert() -> None:
        points = []
        for embedding, payload in zip(embeddings, payloads, strict=True):
            # Use source_id with chunk_index as ID for proper upsert behavior
            source_id = payload.get("source_id")
            chunk_index = payload.get("chunk_index", 0)

            if source_id:
                # Create deterministic UUID from source_id:chunk_index
                # This ensures same content always gets same ID for proper upsert
                content_key = f"{source_id}:{chunk_index}"
                # Generate UUID5 from content_key for Qdrant compatibility
                point_id = str(
                    UUID(bytes=hashlib.md5(content_key.encode()).digest(), version=4)
                )
            else:
                point_id = str(uuid4())

            points.append(
                qm.PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=payload,
                )
            )

        client.upsert(collection_name=settings.qdrant_collection, points=points)

    await asyncio.to_thread(_upsert)


async def search(
    embedding: Sequence[float], limit: int, flt: Optional[qm.Filter] = None
) -> List[qm.ScoredPoint]:
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
