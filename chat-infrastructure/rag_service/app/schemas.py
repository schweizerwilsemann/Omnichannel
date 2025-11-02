from __future__ import annotations

from datetime import datetime
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


class EmbedRequest(BaseModel):
    texts: List[str]


class EmbedResponse(BaseModel):
    embeddings: List[List[float]]


class ClarificationRecord(BaseModel):
    clarification_id: str = Field(...)
    query_time: datetime
    raw_query: str
    normalized_query: Optional[str] = None
    tokens: Any = None
    intents: Any = None
    ambiguity_score: Optional[float] = None
    query_metadata: Any = None
    question_text: str
    clarification_metadata: Any = None
    user_reply: str
    resolved_intent: Optional[str] = None
    resolution_status: str
    resolved_item_id: Optional[str] = None
    resolved_item_name: Optional[str] = None


class ClarificationResponse(BaseModel):
    count: int
    items: List[ClarificationRecord]


class ClarificationPredictRequest(BaseModel):
    features: Dict[str, Any]


class ClarificationPredictResponse(BaseModel):
    prediction: int
    probability: float
    feature_order: List[str]
    feature_values: List[float]
    missing_features: List[str]
    model_metadata: Dict[str, Any] = Field(default_factory=dict)
