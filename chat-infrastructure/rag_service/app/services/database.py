from __future__ import annotations

import json
from datetime import datetime
from functools import lru_cache
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from urllib.parse import quote_plus

from ..config import get_settings


def build_connection_uri() -> str:
    settings = get_settings()
    if settings.db_uri:
        return settings.db_uri

    host = settings.db_host
    name = settings.db_name
    user = settings.db_user
    if not all([host, name, user]):
        raise ValueError("Database connection is not configured (set DB_URI or DB_HOST/DB_NAME/DB_USER).")

    password = settings.db_password or ""
    port = settings.db_port
    dialect = (settings.db_dialect or "mysql").lower()

    driver_map = {
        "mysql": "mysql+mysqlconnector",
        "postgres": "postgresql+psycopg",
        "postgresql": "postgresql+psycopg",
    }
    driver = driver_map.get(dialect)
    if not driver:
        raise ValueError(f"Unsupported DB_DIALECT '{dialect}'. Provide DB_URI instead.")

    user_part = quote_plus(user)
    if password:
        user_part = f"{user_part}:{quote_plus(password)}"

    port_part = f":{port}" if port else ""
    return f"{driver}://{user_part}@{host}{port_part}/{name}"


@lru_cache()
def get_engine() -> Engine:
    uri = build_connection_uri()
    return create_engine(uri)


def run_clarification_query(limit: int, start_at: datetime | None, end_at: datetime | None) -> list[dict[str, Any]]:
    stmt = """
SELECT
    c.id                  AS clarification_id,
    l.created_at          AS query_time,
    l.raw_query,
    l.normalized_query,
    l.tokens,
    l.intents,
    l.ambiguity_score,
    l.metadata            AS query_metadata,
    c.question_text,
    c.metadata            AS clarification_metadata,
    c.user_reply,
    c.resolved_intent,
    l.resolution_status,
    l.resolved_item_id,
    i.name                AS resolved_item_name
FROM menu_query_clarifications c
JOIN menu_query_logs l
  ON l.id = c.query_log_id
LEFT JOIN menu_items i
  ON i.id = l.resolved_item_id
WHERE c.user_reply IS NOT NULL
"""

    params: dict[str, Any] = {"limit": limit}
    if start_at:
        stmt += "  AND l.created_at >= :start_at\n"
        params["start_at"] = start_at
    if end_at:
        stmt += "  AND l.created_at <= :end_at\n"
        params["end_at"] = end_at

    stmt += "ORDER BY l.created_at DESC\nLIMIT :limit"

    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(text(stmt), params)
        return [dict(row) for row in result.mappings()]


def maybe_parse_json(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.startswith("{") or stripped.startswith("["):
            try:
                return json.loads(stripped)
            except json.JSONDecodeError:
                return value
    return value
