from __future__ import annotations

from typing import List, Tuple

from ..config import get_settings
from ..schemas import RagQueryRequest, SourceChunk
from .cache import get_cached_answer, set_cached_answer
from .embedding import embed_texts
from .generator import generate_answer, translate_text
from .vectorstore import search
from qdrant_client.http import models as qm


async def answer_question(request: RagQueryRequest) -> Tuple[str, List[SourceChunk], bool]:
    settings = get_settings()
    # cached = await get_cached_answer(request.question, request.restaurant_id)
    # if cached:
    #     sources = [SourceChunk(**source) for source in cached.get("sources", [])]
    #     return cached.get("answer", ""), sources, True

    # 1) translate user question -> English for embedding/search if needed
    question_en = await translate_text(request.question, "English")

    # 2) embed the translated question (so it matches English-oriented vectors)
    question_embedding = (await embed_texts([question_en]))[0]

    top_k = request.top_k or settings.max_result_chunks
    query_filter = None
    if request.restaurant_id:
        query_filter = qm.Filter(
            must=[
                qm.FieldCondition(
                    key="restaurant_id",
                    match=qm.MatchValue(value=request.restaurant_id),
                )
            ]
        )

    
    results = await search(question_embedding, top_k, query_filter)
    print("results", results)
    context_snippets: List[str] = []
    sources: List[SourceChunk] = []
    for point in results:
        payload = point.payload or {}

        # Build a fallback chunk_text from available fields when 'chunk_text' is not present
        chunk_text = payload.get("chunk_text")
        if not chunk_text:
            parts = []
            if payload.get("name"):
                parts.append(str(payload.get("name")))
            if payload.get("description"):
                parts.append(str(payload.get("description")))
            if payload.get("category_name"):
                parts.append(f"Category: {payload.get('category_name')}")
            if payload.get("key_ingredients"):
                try:
                    parts.append("Ingredients: " + ", ".join(payload.get("key_ingredients")))
                except Exception:
                    parts.append(str(payload.get("key_ingredients")))
            chunk_text = " — ".join([p for p in parts if p]).strip()

        if not chunk_text:
            # debug: no usable text, log payload keys and skip
            print("skip point, no text fields, payload keys=", list(payload.keys()))
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
    print("context_snippets", context_snippets)

    # 3) generate answer in English (context and question_en)
    answer_en = await generate_answer(question_en, context)

    # 4) translate final answer -> Vietnamese before caching/returning
    answer_vi = await translate_text(answer_en, "Vietnamese")

    await set_cached_answer(
        request.question,
        request.restaurant_id,
        answer_vi,
        [source.model_dump() for source in sources],
        settings.cache_ttl_seconds,
        request.session_id,
    )
    return answer_vi, sources, False
