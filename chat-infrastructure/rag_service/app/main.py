from __future__ import annotations

from fastapi import FastAPI

from .config import get_settings
from .routers import rag


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Restaurant RAG Service",
        description="Retrieval augmented generation service for customer support.",
        version="0.1.0",
    )

    @app.get("/")
    async def root() -> dict[str, str]:
        return {
            "message": "RAG service is running.",
            "collection": settings.qdrant_collection,
        }

    app.include_router(rag.router)
    return app


app = create_app()
