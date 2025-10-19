from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class DocumentMetadata(BaseModel):
    restaurant_id: Optional[str] = Field(default=None)
    source_id: Optional[str] = Field(default=None)
    tags: List[str] = Field(default_factory=list)
    extras: Dict[str, Any] = Field(default_factory=dict)


class IngestDocument(BaseModel):
    text: str = Field(..., description="Full text to be chunked and embedded.")
    metadata: DocumentMetadata = Field(default_factory=DocumentMetadata)


class IngestRequest(BaseModel):
    documents: List[IngestDocument]
    chunk_size: int = Field(500, ge=100, le=2000)
    chunk_overlap: int = Field(100, ge=0, le=500)


class SourceChunk(BaseModel):
    text: str
    score: float
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RagQueryRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    restaurant_id: Optional[str] = None
    top_k: Optional[int] = Field(default=None, ge=1, le=10)


class RagQueryResponse(BaseModel):
    answer: str
    sources: List[SourceChunk]
    cached: bool = False


class HealthResponse(BaseModel):
    service: str
    qdrant: str
    redis: str
