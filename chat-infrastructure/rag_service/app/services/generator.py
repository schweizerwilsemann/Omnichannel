from __future__ import annotations

import httpx

from ..config import get_settings

SYSTEM_PROMPT = (
    "You are a helpful assistant for a restaurant brand. "
    "Use ONLY the information provided in the context snippets below to answer customer questions. "
    "When answering questions about promotions, offers, or deals: "
    "- If a promotion is listed in the context with a schedule that includes today's date, it IS currently available. "
    "- Report promotions exactly as they appear in the context without making assumptions about their availability. "
    "- If no promotion information is in the context, reply that promotion information is unavailable. "
    "Do not infer, assume, or add information not explicitly stated in the context. "
    "Be direct and helpful in your responses."
)


def _build_prompt(question: str, context: str) -> str:
    return f"{SYSTEM_PROMPT}\n\nContext:\n{context}\n\nQuestion: {question}\nAnswer:"


async def generate_answer(question: str, context: str) -> str:
    settings = get_settings()
    payload = {
        "model": settings.ollama_generate_model,
        "prompt": _build_prompt(question, context),
        "stream": False,
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.ollama_host}/api/generate", json=payload, timeout=120
        )
        response.raise_for_status()
        data = response.json()
    return data.get("response", "").strip()
