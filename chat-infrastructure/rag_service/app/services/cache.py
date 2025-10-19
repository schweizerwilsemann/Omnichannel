from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Optional

from redis.exceptions import ResponseError

from redis.asyncio import Redis

from ..config import get_settings

_redis_client: Redis | None = None
_lua_sha: str | None = None
_SCRIPT_PATH = Path(__file__).resolve().parents[2] / "scripts" / "lua" / "cache_answer.lua"


def _build_key(question: str, restaurant_id: str | None) -> str:
    digest = hashlib.sha256(question.strip().lower().encode("utf-8")).hexdigest()
    if restaurant_id:
        return f"rag:answer:{restaurant_id}:{digest}"
    return f"rag:answer:{digest}"


def get_client() -> Redis:
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


async def get_cached_answer(question: str, restaurant_id: str | None) -> Optional[Dict[str, Any]]:
    client = get_client()
    key = _build_key(question, restaurant_id)
    data = await client.hgetall(key)
    if not data:
        return None
    if "sources" in data:
        try:
            data["sources"] = json.loads(data["sources"])
        except json.JSONDecodeError:
            data["sources"] = []
    return data


async def set_cached_answer(
    question: str,
    restaurant_id: str | None,
    answer: str,
    sources: list[dict[str, Any]],
    ttl_seconds: int,
    session_id: str | None,
) -> None:
    client = get_client()
    key = _build_key(question, restaurant_id)
    await _eval_cache_script(client, key, answer, sources, ttl_seconds, session_id, question)


async def _eval_cache_script(
    client: Redis,
    key: str,
    answer: str,
    sources: list[dict[str, Any]],
    ttl_seconds: int,
    session_id: str | None,
    question: str,
) -> None:
    global _lua_sha
    payload = [
        answer,
        json.dumps(sources),
        str(ttl_seconds),
        session_id or "",
        question,
    ]

    if _lua_sha is None:
        script = _SCRIPT_PATH.read_text(encoding="utf-8")
        _lua_sha = await client.script_load(script)

    try:
        await client.evalsha(_lua_sha, 1, key, *payload)
    except ResponseError as exc:
        if "NOSCRIPT" in str(exc):
            script = _SCRIPT_PATH.read_text(encoding="utf-8")
            _lua_sha = await client.script_load(script)
            await client.evalsha(_lua_sha, 1, key, *payload)
        else:
            raise
