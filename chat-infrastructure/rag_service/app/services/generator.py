from __future__ import annotations

import httpx

from ..config import get_settings

SYSTEM_PROMPT = (
    "You are a helpful assistant for a restaurant brand. "
    "Use only the supplied context snippets to answer customer questions. "
    "If the answer is not present, reply that the information is unavailable."
)


def _build_prompt(question: str, context: str) -> str:
    return (
        f"{SYSTEM_PROMPT}\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {question}\n"
        "Answer:"
    )


async def generate_answer(question: str, context: str) -> str:
    settings = get_settings()
    payload = {
        "model": settings.ollama_generate_model,
        "prompt": _build_prompt(question, context),
        "stream": False,
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{settings.ollama_host}/api/generate", json=payload, timeout=120)
        response.raise_for_status()
        data = response.json()
    return data.get("response", "").strip()
