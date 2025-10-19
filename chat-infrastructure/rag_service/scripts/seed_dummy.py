from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.schemas import DocumentMetadata, IngestDocument, IngestRequest  # noqa: E402
from app.services.ingest import ingest_documents  # noqa: E402


def load_dataset(path: Path) -> List[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def build_ingest_payload(rows: List[Dict[str, Any]], chunk_size: int, chunk_overlap: int) -> IngestRequest:
    documents: List[IngestDocument] = []
    for row in rows:
        question = row.get("question", "").strip()
        answer = row.get("answer", "").strip()
        if not answer:
            continue
        text = f"Question: {question}\nAnswer: {answer}"
        metadata = DocumentMetadata(
            restaurant_id=row.get("restaurant_id"),
            source_id=row.get("source_id"),
            tags=row.get("tags", []),
            extras=row.get("extras", {}),
        )
        documents.append(IngestDocument(text=text, metadata=metadata))
    return IngestRequest(documents=documents, chunk_size=chunk_size, chunk_overlap=chunk_overlap)


async def run(path: Path, chunk_size: int, chunk_overlap: int) -> None:
    rows = load_dataset(path)
    payload = build_ingest_payload(rows, chunk_size, chunk_overlap)
    inserted = await ingest_documents(payload)
    print(f"Ingested {inserted} chunks from {len(payload.documents)} documents.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Qdrant with dummy restaurant FAQ data.")
    parser.add_argument("--input", type=Path, default=ROOT / "data" / "dummy_faq.json", help="Path to JSON dataset.")
    parser.add_argument("--chunk-size", type=int, default=400, help="Number of tokens per chunk window.")
    parser.add_argument("--chunk-overlap", type=int, default=80, help="Number of tokens to overlap between chunks.")
    args = parser.parse_args()

    asyncio.run(run(args.input, args.chunk_size, args.chunk_overlap))


if __name__ == "__main__":
    main()
