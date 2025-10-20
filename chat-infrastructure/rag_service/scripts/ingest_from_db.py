from __future__ import annotations

import argparse
import asyncio
import os
import sys
from collections import defaultdict
import json
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from dotenv import load_dotenv
import mysql.connector
from mysql.connector.cursor import MySQLCursorDict

RAG_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = RAG_ROOT.parents[1]
MONOREPO_ROOT = PROJECT_ROOT.parent
if str(RAG_ROOT) not in sys.path:
    sys.path.insert(0, str(RAG_ROOT))

from app.schemas import DocumentMetadata, IngestDocument, IngestRequest  # noqa: E402
from app.services.ingest import ingest_documents  # noqa: E402


DEFAULT_ENV_PATHS = [
    RAG_ROOT / ".env",
    PROJECT_ROOT / ".env",
    MONOREPO_ROOT / ".env",
    PROJECT_ROOT / "be" / ".env",
    MONOREPO_ROOT / "be" / ".env",
]


def _maybe_parse_json(value: Any) -> Any:
    if isinstance(value, (dict, list)) or value is None:
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            return None
    return value


@dataclass
class RestaurantRow:
    id: str
    name: str
    timezone: str
    status: str
    address: Optional[dict]
    business_hours: Optional[dict]


@dataclass
class MenuItemRow:
    id: str
    restaurant_id: str
    restaurant_name: str
    category_id: str
    category_name: str
    sku: str
    name: str
    description: Optional[str]
    price_cents: int
    prep_time_seconds: Optional[int]
    is_available: bool


@dataclass
class PromotionRow:
    id: str
    restaurant_id: str
    restaurant_name: str
    name: str
    headline: Optional[str]
    description: Optional[str]
    starts_at: Optional[datetime]
    ends_at: Optional[datetime]
    status: str


@dataclass
class VoucherRow:
    id: str
    promotion_id: Optional[str]
    restaurant_id: str
    code: str
    name: str
    description: Optional[str]
    discount_type: str
    allow_stack_with_points: bool
    valid_from: Optional[datetime]
    valid_until: Optional[datetime]
    terms_url: Optional[str]


@dataclass
class VoucherTierRow:
    voucher_id: str
    min_spend_cents: Optional[int]
    discount_percent: Optional[Decimal]
    max_discount_cents: Optional[int]
    sort_order: int


def load_env_files(extra_env: Optional[Iterable[Path]]) -> None:
    """
    Load environment variables from useful defaults plus any explicitly provided files.
    """
    for path in DEFAULT_ENV_PATHS:
        if path.exists():
            load_dotenv(path, override=False)
    if extra_env:
        for path in extra_env:
            if path.exists():
                load_dotenv(path, override=True)


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
        missing_vars = ", ".join(missing)
        raise RuntimeError(
            f"Missing database configuration for: {missing_vars}. "
            "Provide CLI options or set the corresponding environment variables."
        )
    return config


def connect_database(config: Dict[str, Any]):
    return mysql.connector.connect(**config)


def fetch_restaurants(cursor: MySQLCursorDict, restaurant_ids: Optional[List[str]]) -> Dict[str, RestaurantRow]:
    query = """
        SELECT id, name, timezone, status, address, business_hours
        FROM restaurants
        WHERE deleted_at IS NULL
    """
    params: List[Any] = []
    if restaurant_ids:
        placeholders = ", ".join(["%s"] * len(restaurant_ids))
        query += f" AND id IN ({placeholders})"
        params.extend(restaurant_ids)

    cursor.execute(query, params)
    rows: Dict[str, RestaurantRow] = {}
    for record in cursor.fetchall():
        address = _maybe_parse_json(record.get("address"))
        business_hours = _maybe_parse_json(record.get("business_hours"))

        rows[record["id"]] = RestaurantRow(
            id=record["id"],
            name=record["name"],
            timezone=record.get("timezone") or "UTC",
            status=record.get("status") or "UNKNOWN",
            address=address,
            business_hours=business_hours,
        )
    return rows


def fetch_menu_items(cursor: MySQLCursorDict, restaurant_ids: Optional[List[str]]) -> List[MenuItemRow]:
    query = """
        SELECT
            mi.id,
            mi.name,
            mi.description,
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
          AND mc.is_active = TRUE
    """
    params: List[Any] = []
    if restaurant_ids:
        placeholders = ", ".join(["%s"] * len(restaurant_ids))
        query += f" AND r.id IN ({placeholders})"
        params.extend(restaurant_ids)

    cursor.execute(query, params)
    rows: List[MenuItemRow] = []
    for record in cursor.fetchall():
        rows.append(
            MenuItemRow(
                id=record["id"],
                restaurant_id=record["restaurant_id"],
                restaurant_name=record["restaurant_name"],
                category_id=record["category_id"],
                category_name=record["category_name"],
                sku=record["sku"],
                name=record["name"],
                description=record.get("description"),
                price_cents=record.get("price_cents") or 0,
                prep_time_seconds=record.get("prep_time_seconds"),
                is_available=bool(record.get("is_available", True)),
            )
        )
    return rows


def fetch_promotions(cursor: MySQLCursorDict, restaurant_ids: Optional[List[str]]) -> List[PromotionRow]:
    query = """
        SELECT
            p.id,
            p.restaurant_id,
            r.name AS restaurant_name,
            p.name,
            p.headline,
            p.description,
            p.starts_at,
            p.ends_at,
            p.status
        FROM promotions p
        INNER JOIN restaurants r ON r.id = p.restaurant_id
        WHERE r.deleted_at IS NULL
    """
    params: List[Any] = []
    if restaurant_ids:
        placeholders = ", ".join(["%s"] * len(restaurant_ids))
        query += f" AND p.restaurant_id IN ({placeholders})"
        params.extend(restaurant_ids)

    cursor.execute(query, params)
    rows: List[PromotionRow] = []
    for record in cursor.fetchall():
        rows.append(
            PromotionRow(
                id=record["id"],
                restaurant_id=record["restaurant_id"],
                restaurant_name=record["restaurant_name"],
                name=record["name"],
                headline=record.get("headline"),
                description=record.get("description"),
                starts_at=record.get("starts_at"),
                ends_at=record.get("ends_at"),
                status=record.get("status") or "UNKNOWN",
            )
        )
    return rows


def fetch_vouchers(cursor: MySQLCursorDict, restaurant_ids: Optional[List[str]]) -> List[VoucherRow]:
    query = """
        SELECT
            v.id,
            v.promotion_id,
            v.restaurant_id,
            v.code,
            v.name,
            v.description,
            v.discount_type,
            v.allow_stack_with_points,
            v.valid_from,
            v.valid_until,
            v.terms_url
        FROM vouchers v
    """
    params: List[Any] = []
    if restaurant_ids:
        placeholders = ", ".join(["%s"] * len(restaurant_ids))
        query += f" WHERE v.restaurant_id IN ({placeholders})"
        params.extend(restaurant_ids)

    cursor.execute(query, params)
    rows: List[VoucherRow] = []
    for record in cursor.fetchall():
        rows.append(
            VoucherRow(
                id=record["id"],
                promotion_id=record.get("promotion_id"),
                restaurant_id=record["restaurant_id"],
                code=record["code"],
                name=record["name"],
                description=record.get("description"),
                discount_type=record.get("discount_type") or "",
                allow_stack_with_points=bool(record.get("allow_stack_with_points", True)),
                valid_from=record.get("valid_from"),
                valid_until=record.get("valid_until"),
                terms_url=record.get("terms_url"),
            )
        )
    return rows


def fetch_voucher_tiers(cursor: MySQLCursorDict, voucher_ids: Iterable[str]) -> Dict[str, List[VoucherTierRow]]:
    tiers: Dict[str, List[VoucherTierRow]] = defaultdict(list)
    ids = list(voucher_ids)
    if not ids:
        return tiers

    placeholders = ", ".join(["%s"] * len(ids))
    query = f"""
        SELECT
            voucher_id,
            min_spend_cents,
            discount_percent,
            max_discount_cents,
            sort_order
        FROM voucher_tiers
        WHERE voucher_id IN ({placeholders})
        ORDER BY voucher_id, sort_order ASC
    """

    cursor.execute(query, ids)
    for record in cursor.fetchall():
        tiers[record["voucher_id"]].append(
            VoucherTierRow(
                voucher_id=record["voucher_id"],
                min_spend_cents=record.get("min_spend_cents"),
                discount_percent=record.get("discount_percent"),
                max_discount_cents=record.get("max_discount_cents"),
                sort_order=record.get("sort_order") or 0,
            )
        )
    return tiers


def fmt_money_cents(cents: Optional[int]) -> Optional[str]:
    if cents is None:
        return None
    return f"${cents / 100:,.2f}"


def fmt_percent(value: Optional[Decimal]) -> Optional[str]:
    if value is None:
        return None
    return f"{float(value):.0f}%"


def fmt_datetime(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt)


def format_address(address: Optional[dict]) -> str:
    if not address:
        return ""
    parts = [
        address.get("street"),
        address.get("city"),
        address.get("state"),
        address.get("zipCode"),
        address.get("country"),
    ]
    return ", ".join(str(part) for part in parts if part)


def format_business_hours(hours: Optional[dict]) -> List[str]:
    if not isinstance(hours, dict):
        return []
    ordered_days = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ]
    lines: List[str] = []
    for day in ordered_days:
        window = hours.get(day)
        if not isinstance(window, dict):
            continue
        open_time = window.get("open")
        close_time = window.get("close")
        if not open_time and not close_time:
            continue
        display = []
        if open_time:
            display.append(open_time)
        if close_time:
            display.append(close_time)
        if not display:
            continue
        lines.append(f"{day.capitalize()}: {' - '.join(display)}")
    return lines


def build_restaurant_documents(restaurants: Dict[str, RestaurantRow]) -> List[IngestDocument]:
    documents: List[IngestDocument] = []
    for restaurant in restaurants.values():
        address = format_address(restaurant.address)
        lines = [
            f"Restaurant: {restaurant.name}",
            f"Status: {restaurant.status}",
            f"Timezone: {restaurant.timezone}",
        ]
        if address:
            lines.append(f"Address: {address}")
        hours_lines = format_business_hours(restaurant.business_hours)
        if hours_lines:
            lines.append("Business Hours:")
            lines.extend(hours_lines)
        text = "\n".join(lines)
        metadata = DocumentMetadata(
            restaurant_id=restaurant.id,
            source_id=f"restaurant:{restaurant.id}",
            tags=["restaurant", "profile"],
            extras={
                "restaurant_name": restaurant.name,
                "business_hours": restaurant.business_hours or {},
            },
        )
        documents.append(IngestDocument(text=text, metadata=metadata))
    return documents


def build_menu_documents(menu_items: List[MenuItemRow]) -> List[IngestDocument]:
    documents: List[IngestDocument] = []
    for item in menu_items:
        if not item.is_available:
            continue

        price = fmt_money_cents(item.price_cents)
        lines = [
            f"Restaurant: {item.restaurant_name}",
            f"Menu Category: {item.category_name}",
            f"Menu Item: {item.name}",
            f"SKU: {item.sku}",
        ]
        if price:
            lines.append(f"Price: {price}")
        if item.description:
            lines.append(f"Description: {item.description}")
        if item.prep_time_seconds:
            lines.append(f"Approx Prep Time: {item.prep_time_seconds // 60} minutes")

        text = "\n".join(lines)
        metadata = DocumentMetadata(
            restaurant_id=item.restaurant_id,
            source_id=f"menu-item:{item.id}",
            tags=["menu", item.category_name],
            extras={
                "menu_item_id": item.id,
                "menu_category_id": item.category_id,
                "restaurant_name": item.restaurant_name,
            },
        )
        documents.append(IngestDocument(text=text, metadata=metadata))
    return documents


def build_promotion_documents(
    promotions: List[PromotionRow],
    vouchers: Dict[str, List[VoucherRow]],
    voucher_tiers: Dict[str, List[VoucherTierRow]],
) -> List[IngestDocument]:
    documents: List[IngestDocument] = []
    for promo in promotions:
        lines = [
            f"Restaurant: {promo.restaurant_name}",
            f"Promotion: {promo.name}",
            f"Status: {promo.status}",
        ]
        if promo.headline:
            lines.append(f"Headline: {promo.headline}")
        if promo.description:
            lines.append(f"Description: {promo.description}")
        if promo.starts_at:
            lines.append(f"Starts At: {fmt_datetime(promo.starts_at)}")
        if promo.ends_at:
            lines.append(f"Ends At: {fmt_datetime(promo.ends_at)}")

        attached_vouchers = vouchers.get(promo.id, [])
        if attached_vouchers:
            for voucher in attached_vouchers:
                lines.append("")
                lines.append(f"Voucher Code: {voucher.code}")
                lines.append(f"Voucher Name: {voucher.name}")
                if voucher.description:
                    lines.append(f"Voucher Details: {voucher.description}")
                lines.append(f"Discount Type: {voucher.discount_type}")
                lines.append(
                    "Can Stack With Points: YES" if voucher.allow_stack_with_points else "Can Stack With Points: NO"
                )
                if voucher.valid_from or voucher.valid_until:
                    validity = " - ".join(
                        filter(
                            None,
                            [fmt_datetime(voucher.valid_from), fmt_datetime(voucher.valid_until)],
                        )
                    )
                    lines.append(f"Validity: {validity}")
                if voucher.terms_url:
                    lines.append(f"Terms URL: {voucher.terms_url}")

                tiers = voucher_tiers.get(voucher.id, [])
                for tier in tiers:
                    tier_parts = []
                    if tier.min_spend_cents is not None:
                        tier_parts.append(f"Min Spend {fmt_money_cents(tier.min_spend_cents)}")
                    if tier.discount_percent is not None:
                        tier_parts.append(f"Discount {fmt_percent(tier.discount_percent)}")
                    if tier.max_discount_cents is not None:
                        tier_parts.append(f"Max Discount {fmt_money_cents(tier.max_discount_cents)}")
                    if tier_parts:
                        lines.append("Voucher Tier: " + ", ".join(tier_parts))

        text = "\n".join(lines)
        metadata = DocumentMetadata(
            restaurant_id=promo.restaurant_id,
            source_id=f"promotion:{promo.id}",
            tags=["promotion"],
            extras={
                "promotion_id": promo.id,
                "restaurant_name": promo.restaurant_name,
            },
        )
        documents.append(IngestDocument(text=text, metadata=metadata))
    return documents


async def run_ingestion(args: argparse.Namespace) -> None:
    load_env_files([Path(path) for path in args.env_file] if args.env_file else None)
    config = get_db_config(args)

    connection = connect_database(config)
    try:
        cursor = connection.cursor(dictionary=True)

        restaurant_ids = args.restaurant_id or None
        restaurants = fetch_restaurants(cursor, restaurant_ids)
        if not restaurants:
            print("No restaurants found that match the provided filters.")
            return

        menu_items = fetch_menu_items(cursor, restaurant_ids)
        promotions = fetch_promotions(cursor, restaurant_ids)

        vouchers_list = fetch_vouchers(cursor, restaurant_ids)
        voucher_by_promo: Dict[str, List[VoucherRow]] = defaultdict(list)
        for voucher in vouchers_list:
            if voucher.promotion_id:
                voucher_by_promo[voucher.promotion_id].append(voucher)

        tiers = fetch_voucher_tiers(cursor, [voucher.id for voucher in vouchers_list])

        documents: List[IngestDocument] = []
        documents.extend(build_restaurant_documents(restaurants))
        documents.extend(build_menu_documents(menu_items))
        documents.extend(build_promotion_documents(promotions, voucher_by_promo, tiers))

        if not documents:
            print("No documents generated from database content.")
            return

        payload = IngestRequest(
            documents=documents,
            chunk_size=args.chunk_size,
            chunk_overlap=args.chunk_overlap,
        )
        inserted = await ingest_documents(payload)
        print(f"Ingested {inserted} chunks from {len(documents)} documents.")
    finally:
        connection.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest restaurant data from the operational database into Qdrant.")
    parser.add_argument("--db-host", help="Database host (defaults to DB_HOST env).")
    parser.add_argument("--db-port", help="Database port (defaults to DB_PORT env).")
    parser.add_argument("--db-user", help="Database user (defaults to DB_USER env).")
    parser.add_argument("--db-password", help="Database password (defaults to DB_PASSWORD env).")
    parser.add_argument("--db-name", help="Database name (defaults to DB_NAME env).")
    parser.add_argument(
        "--env-file",
        action="append",
        default=[],
        help="Optional .env files to load (can be passed multiple times).",
    )
    parser.add_argument(
        "--restaurant-id",
        action="append",
        default=[],
        help="Limit ingestion to specific restaurant UUIDs (can be passed multiple times).",
    )
    parser.add_argument("--chunk-size", type=int, default=400, help="Token window size for chunking.")
    parser.add_argument("--chunk-overlap", type=int, default=80, help="Token overlap between chunks.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asyncio.run(run_ingestion(args))


if __name__ == "__main__":
    main()
