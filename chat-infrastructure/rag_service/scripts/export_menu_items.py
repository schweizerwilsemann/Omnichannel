from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
import mysql.connector
from mysql.connector.cursor import MySQLCursorDict

RAG_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = RAG_ROOT.parents[1]
MONOREPO_ROOT = PROJECT_ROOT.parent

if str(RAG_ROOT) not in sys.path:
    sys.path.insert(0, str(RAG_ROOT))


DEFAULT_ENV_PATHS = [
    RAG_ROOT / ".env",
    PROJECT_ROOT / ".env",
    MONOREPO_ROOT / ".env",
    PROJECT_ROOT / "be" / ".env",
    MONOREPO_ROOT / "be" / ".env",
]


def load_env_files(extra_env: Optional[List[str]]) -> None:
    for path in DEFAULT_ENV_PATHS:
        if path.exists():
            load_dotenv(path, override=False)
    if extra_env:
        for entry in extra_env:
            env_path = Path(entry)
            if env_path.exists():
                load_dotenv(env_path, override=True)


def get_db_config(args: argparse.Namespace) -> Dict[str, Any]:
    config = {
        "host": args.db_host or os.getenv("DB_HOST", "localhost"),
        "port": int(args.db_port or os.getenv("DB_PORT", 3306)),
        "user": args.db_user or os.getenv("DB_USER", "root"),
        "password": args.db_password or os.getenv("DB_PASSWORD", ""),
        "database": args.db_name or os.getenv("DB_NAME"),
    }
    missing = [key for key, value in config.items() if value in (None, "")]
    if missing:
        raise RuntimeError(
            "Missing database configuration for: "
            + ", ".join(missing)
            + ". Provide CLI flags or set env vars DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME."
        )
    return config


def connect_database(config: Dict[str, Any]):
    return mysql.connector.connect(**config)


def fetch_menu_items(cursor: MySQLCursorDict, restaurant_ids: Optional[List[str]]) -> List[Dict[str, Any]]:
    query = """
        SELECT
            mi.id,
            mi.name,
            mi.description,
            mi.image_url,
            mi.price_cents,
            mi.prep_time_seconds,
            mi.is_available,
            mi.sku,
            mc.id AS category_id,
            mc.name AS category_name,
            r.id AS restaurant_id,
            r.name AS restaurant_name
        FROM menu_items mi
        INNER JOIN menu_categories mc ON mc.id = mi.category_id
        INNER JOIN restaurants r ON r.id = mc.restaurant_id
        WHERE r.deleted_at IS NULL
    """
    params: List[Any] = []
    if restaurant_ids:
        placeholders = ", ".join(["%s"] * len(restaurant_ids))
        query += f" AND r.id IN ({placeholders})"
        params.extend(restaurant_ids)

    cursor.execute(query, params)
    rows: List[Dict[str, Any]] = []
    for record in cursor.fetchall():
        rows.append(
            {
                "menu_item_id": record["id"],
                "restaurant_id": record["restaurant_id"],
                "restaurant_name": record["restaurant_name"],
                "category_id": record["category_id"],
                "category_name": record["category_name"],
                "sku": record["sku"],
                "name": record["name"],
                "description": record.get("description"),
                "image_url": record.get("image_url"),
                "price_cents": int(record.get("price_cents") or 0),
                "prep_time_seconds": record.get("prep_time_seconds"),
                "is_available": bool(record.get("is_available", True)),
            }
        )
    return rows


def write_output(data: List[Dict[str, Any]], output_path: Optional[str]) -> None:
    payload = {
        "exported_at": os.getenv("EXPORT_TIMESTAMP") or None,
        "count": len(data),
        "items": data,
    }
    text = json.dumps(payload, indent=2, ensure_ascii=False)
    if output_path:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        print(f"Wrote {len(data)} menu items to {path}")
    else:
        print(text)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export menu items to JSON for ML training.")
    parser.add_argument("--db-host")
    parser.add_argument("--db-port")
    parser.add_argument("--db-user")
    parser.add_argument("--db-password")
    parser.add_argument("--db-name")
    parser.add_argument("--env-file", action="append", default=[])
    parser.add_argument(
        "--restaurant-id",
        action="append",
        default=[],
        help="Optional restaurant UUID filter (can be passed multiple times).",
    )
    parser.add_argument(
        "--output",
        help="If provided, write JSON to this file. Otherwise prints to stdout.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    load_env_files(args.env_file)
    config = get_db_config(args)
    connection = connect_database(config)
    try:
        cursor = connection.cursor(dictionary=True)
        rows = fetch_menu_items(cursor, args.restaurant_id or None)
        if not rows:
            print("No menu items matched the provided filters.")
            return
        write_output(rows, args.output)
    finally:
        connection.close()


if __name__ == "__main__":
    main()
