from __future__ import annotations

from typing import List

from ..schemas import IngestDocument, IngestRequest
from .chunker import sliding_window_chunks
from .embedding import embed_texts
from .vectorstore import ensure_collection, upsert_embeddings


async def ingest_documents(payload: IngestRequest) -> int:
    chunks: List[str] = []
    chunk_payloads: List[dict] = []

    for doc in payload.documents:
        doc_chunks = sliding_window_chunks(doc.text, payload.chunk_size, payload.chunk_overlap)
        for idx, chunk in enumerate(doc_chunks):
            meta = doc.metadata.model_dump(exclude_none=True)
            meta["chunk_index"] = idx
            meta["chunk_text"] = chunk
            chunks.append(chunk)
            chunk_payloads.append(meta)

    if not chunks:
        return 0

    embeddings = await embed_texts(chunks)
    await ensure_collection(vector_size=len(embeddings[0]))
    await upsert_embeddings(embeddings, chunk_payloads)
    return len(chunks)
