from __future__ import annotations

import httpx
import os
import os
from dotenv import load_dotenv

load_dotenv()

CHATBOT_KEY = os.getenv("CHATBOT_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "deepseek/deepseek-v3.2")
print("CHATBOT_KEY", CHATBOT_KEY)
from ..config import get_settings

SYSTEM_PROMPT = (
    "You are a helpful assistant for a restaurant brand. "
    "Use only the supplied context snippets to answer customer questions. "
    "If the answer is not present, reply that the information is unavailable."
)


async def translate_text(text: str, target_language: str) -> str:
    """
    Translate `text` to `target_language` using Google Gemini API.
    """
    prompt = (
        f"Translate the following text to {target_language}. "
        "Return ONLY the translated text without explanation:\n\n"
        f"{text}"
    )

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/"
        f"models/{LLM_MODEL}:generateContent?key={CHATBOT_KEY}"
    )

    payload = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ]
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, timeout=120)
        resp.raise_for_status()
        data = resp.json()

    # Extract the response text
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except:
        return ""


async def generate_answer(question: str, context: str) -> str:
    """
    Answer questions using Google Gemini API with context.
    """
    system_prompt = (
        "You are a helpful assistant for a restaurant brand. "
        "Use only the supplied context to answer the question. "
        "If the answer is not available, say the information is unavailable."
    )

    full_prompt = (
        f"{system_prompt}\n\n"
        f"Context:\n{context}\n\n"
        f"Question:\n{question}\n\n"
        "Answer:"
    )


    url = (
        f"https://generativelanguage.googleapis.com/v1beta/"
        f"models/{LLM_MODEL}:generateContent?key={CHATBOT_KEY}"
    )

    payload = {
        "contents": [
            {"parts": [{"text": full_prompt}]}
        ]
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, timeout=120)
        resp.raise_for_status()
        data = resp.json()

    try:
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except:
        return ""
