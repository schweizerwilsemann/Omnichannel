from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from qdrant_client import QdrantClient, models
import redis
from sentence_transformers import SentenceTransformer


def load_items(path: Path) -> List[Dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return raw.get("items", [])


def canonical_text(item: Dict[str, Any]) -> str:
    tags = ", ".join(item.get("dietary_tags") or [])
    allergens = ", ".join(item.get("allergens") or [])
    ingredients = ", ".join(item.get("key_ingredients") or [])
    pieces = [
        item["name"],
        f"Category: {item.get('category_name', 'Unknown')}.",
        f"Description: {item.get('description') or 'N/A'}.",
        f"Spice level: {item.get('spice_level') or 'unknown'}.",
    ]
    if ingredients:
        pieces.append(f"Ingredients: {ingredients}.")
    if tags:
        pieces.append(f"Dietary tags: {tags}.")
    if allergens:
        pieces.append(f"Allergens: {allergens}.")
    if item.get("contains_alcohol"):
        pieces.append("Contains alcohol.")
    if notes := item.get("notes"):
        pieces.append(f"Notes: {notes}.")
    return " ".join(pieces)


def encode_items(model: SentenceTransformer, items: List[Dict[str, Any]], batch_size: int) -> List[Dict[str, Any]]:
    texts = [canonical_text(item) for item in items]
    vectors = model.encode(texts, batch_size=batch_size, normalize_embeddings=True)
    payloads = []
    for item, vector in zip(items, vectors):
        payloads.append({"item": item, "vector": vector})
    return payloads


def write_json(payloads: List[Dict[str, Any]], path: Path) -> None:
    data = []
    for entry in payloads:
        data.append(
            {
                "menu_item_id": entry["item"]["menu_item_id"],
                "vector": entry["vector"].tolist(),
                "metadata": entry["item"],
            }
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"items": data}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote embeddings to {path}")


def sync_qdrant(
    payloads: List[Dict[str, Any]],
    host: str,
    port: int,
    api_key: Optional[str],
    collection: str,
    recreate: bool,
) -> None:
    client = QdrantClient(host=host, port=port, api_key=api_key)
    vector_size = len(payloads[0]["vector"])
    if recreate:
        client.recreate_collection(
            collection_name=collection,
            vectors_config=models.VectorParams(size=vector_size, distance=models.Distance.COSINE),
        )
    else:
        if not client.collection_exists(collection):
            client.recreate_collection(
                collection_name=collection,
                vectors_config=models.VectorParams(size=vector_size, distance=models.Distance.COSINE),
            )

    points = [
        models.PointStruct(
            id=item["item"]["menu_item_id"],
            vector=item["vector"].tolist(),
            payload=item["item"],
        )
        for item in payloads
    ]
    client.upsert(collection_name=collection, points=points)
    print(f"Upserted {len(points)} vectors into Qdrant collection '{collection}'.")


def sync_redis(
    payloads: List[Dict[str, Any]],
    host: str,
    port: int,
    password: Optional[str],
    prefix: str,
    index_name: str,
    recreate: bool,
) -> None:
    from redis.commands.search.field import TagField, VectorField, TextField
    from redis.commands.search.indexDefinition import IndexDefinition, IndexType
    from redis.commands.search import Search

    r = redis.Redis(host=host, port=port, password=password, decode_responses=False)
    dim = len(payloads[0]["vector"])
    if recreate:
        try:
            r.ft(index_name).dropindex(delete_documents=True)
        except redis.exceptions.ResponseError as err:
            message = str(err).lower()
            if "unknown command" in message:
                print("Redis instance does not support RediSearch/Vector commands. Skipping Redis sync.")
                return
            if "unknown index" not in message:
                raise
        except Exception:
            pass

    try:
        r.ft(index_name).info()
    except redis.exceptions.ResponseError as err:
        if "unknown command" in str(err):
            print("Redis instance does not support RediSearch/Vector commands. Skipping Redis sync.")
            return
        schema = (
            TextField("name"),
            TagField("category"),
            TagField("dietary_tags"),
            TagField("allergens"),
            VectorField("embedding", "FLAT", {"TYPE": "FLOAT32", "DIM": dim, "DISTANCE_METRIC": "COSINE"}),
        )
        r.ft(index_name).create_index(
            schema,
            definition=IndexDefinition(prefix=[prefix], index_type=IndexType.HASH),
        )

    pipe = r.pipeline(transaction=False)
    for entry in payloads:
        item = entry["item"]
        key = f"{prefix}{item['menu_item_id']}"
        vector = np.array(entry["vector"], dtype=np.float32).tobytes()
        pipe.hset(
            key,
            mapping={
                "name": item["name"],
                "category": item.get("category_name", ""),
                "dietary_tags": ",".join(item.get("dietary_tags") or []),
                "allergens": ",".join(item.get("allergens") or []),
                "embedding": vector,
            },
        )
    pipe.execute()
    print(f"Synced {len(payloads)} vectors to Redis prefix '{prefix}'.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Encode menu items with a fine-tuned model and sync to vector stores.")
    parser.add_argument("--input", required=True, help="Path to menu_items_enriched.json")
    parser.add_argument("--model-path", required=True, help="Directory or HF model name for sentence transformer")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--json-output", help="Optional path to dump embeddings JSON")

    # Qdrant
    parser.add_argument("--qdrant-host")
    parser.add_argument("--qdrant-port", type=int, default=6333)
    parser.add_argument("--qdrant-api-key")
    parser.add_argument("--qdrant-collection", default="menu_similarity")
    parser.add_argument("--qdrant-recreate", action="store_true")

    # Redis
    parser.add_argument("--redis-host")
    parser.add_argument("--redis-port", type=int, default=6379)
    parser.add_argument("--redis-password")
    parser.add_argument("--redis-prefix", default="menu:")
    parser.add_argument("--redis-index", default="idx:menu-similarity")
    parser.add_argument("--redis-recreate", action="store_true")

    return parser.parse_args()


def main() -> None:
    args = parse_args()
    items = load_items(Path(args.input))
    if not items:
        raise SystemExit("No items in input.")

    model = SentenceTransformer(args.model_path)
    payloads = encode_items(model, items, args.batch_size)

    if args.json_output:
        write_json(payloads, Path(args.json_output))

    if args.qdrant_host:
        sync_qdrant(
            payloads,
            host=args.qdrant_host,
            port=args.qdrant_port,
            api_key=args.qdrant_api_key,
            collection=args.qdrant_collection,
            recreate=args.qdrant_recreate,
        )

    if args.redis_host:
        sync_redis(
            payloads,
            host=args.redis_host,
            port=args.redis_port,
            password=args.redis_password,
            prefix=args.redis_prefix,
            index_name=args.redis_index,
            recreate=args.redis_recreate,
        )

    if not any([args.json_output, args.qdrant_host, args.redis_host]):
        print("No output target specified. Use --json-output, --qdrant-host, or --redis-host to persist embeddings.")


if __name__ == "__main__":
    main()
