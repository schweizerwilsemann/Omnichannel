from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import analytics, clarification, rag


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Restaurant RAG Service",
        description="Retrieval augmented generation service for customer support.",
        version="0.1.0",
    )

    allow_origins = settings.cors_allow_origins_list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    async def root() -> dict[str, str]:
        return {
            "message": "RAG service is running.",
            "collection": settings.qdrant_collection,
        }

    app.include_router(rag.router)
    app.include_router(analytics.router)
    app.include_router(clarification.router)
    return app


app = create_app()
