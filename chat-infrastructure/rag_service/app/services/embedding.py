from __future__ import annotations

import asyncio
from typing import List, Sequence

import httpx

from ..config import get_settings


async def _embed_single(client: httpx.AsyncClient, text: str) -> List[float]:
    settings = get_settings()
    response = await client.post(
        f"{settings.ollama_host}/api/embeddings",
        json={"model": settings.ollama_embed_model, "prompt": text},
        timeout=60,
    )
    response.raise_for_status()
    embedding = response.json().get("embedding")
    if not embedding:
        raise RuntimeError("Ollama returned an empty embedding.")
    return embedding


async def embed_texts(texts: Sequence[str]) -> List[List[float]]:
    if not texts:
        return []

    async with httpx.AsyncClient() as client:
        tasks = [_embed_single(client, text) for text in texts]
        return await asyncio.gather(*tasks)
