from __future__ import annotations

from typing import Iterable, List


def sliding_window_chunks(text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
    """Split text into overlapping chunks to preserve context around boundaries."""
    tokens = text.split()
    if not tokens:
        return []

    chunks: List[str] = []
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk = " ".join(tokens[start:end]).strip()
        if chunk:
            chunks.append(chunk)
        if end == len(tokens):
            break
        start = max(end - chunk_overlap, start + 1)
    return chunks


def explode_documents(docs: Iterable[str], chunk_size: int, chunk_overlap: int) -> List[str]:
    """Utility to chunk multiple documents, flattening into a single list."""
    all_chunks: List[str] = []
    for doc in docs:
        all_chunks.extend(sliding_window_chunks(doc, chunk_size, chunk_overlap))
    return all_chunks
