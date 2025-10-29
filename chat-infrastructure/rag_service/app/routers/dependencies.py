from __future__ import annotations

from fastapi import Header, HTTPException

from ..config import get_settings


def require_admin_key(x_rag_admin_key: str | None = Header(default=None)) -> None:
    settings = get_settings()
    key = settings.admin_api_key.strip()
    if key and x_rag_admin_key != key:
        raise HTTPException(status_code=401, detail="Missing or invalid admin key")
