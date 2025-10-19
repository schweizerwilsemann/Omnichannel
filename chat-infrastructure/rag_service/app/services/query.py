from __future__ import annotations

from typing import List, Tuple

from ..config import get_settings
from ..schemas import RagQueryRequest, SourceChunk
from .cache import get_cached_answer, set_cached_answer
from .embedding import embed_texts
from .generator import generate_answer
from .vectorstore import search


async def answer_question(request: RagQueryRequest) -> Tuple[str, List[SourceChunk], bool]:
    settings = get_settings()
    cached = await get_cached_answer(request.question, request.restaurant_id)
    if cached:
        sources = [SourceChunk(**source) for source in cached.get("sources", [])]
        return cached.get("answer", ""), sources, True

    question_embedding = (await embed_texts([request.question]))[0]
    top_k = request.top_k or settings.max_result_chunks
    results = await search(question_embedding, top_k)

    context_snippets: List[str] = []
    sources: List[SourceChunk] = []
    for point in results:
        payload = point.payload or {}
        chunk_text = payload.get("chunk_text", "")
        if not chunk_text:
            continue
        context_snippets.append(chunk_text)
        metadata = {
            key: value
            for key, value in payload.items()
            if key not in {"chunk_text"}
        }
        sources.append(
            SourceChunk(
                text=chunk_text,
                score=point.score or 0.0,
                metadata=metadata,
            )
        )

    context = "\n\n".join(context_snippets)
    answer = await generate_answer(request.question, context)
    await set_cached_answer(
        request.question,
        request.restaurant_id,
        answer,
        [source.model_dump() for source in sources],
        settings.cache_ttl_seconds,
        request.session_id,
    )
    return answer, sources, False
