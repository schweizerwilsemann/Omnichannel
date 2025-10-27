from __future__ import annotations

import argparse
import json
import random
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


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


def share_tags(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    a_tags = set(a.get("dietary_tags") or []) | {a.get("spice_level")} | set(a.get("allergens") or [])
    b_tags = set(b.get("dietary_tags") or []) | {b.get("spice_level")} | set(b.get("allergens") or [])
    a_tags.discard(None)
    b_tags.discard(None)
    return len(a_tags & b_tags) > 0


def build_pairs(items: List[Dict[str, Any]], per_item: int, seed: Optional[int]) -> List[Dict[str, Any]]:
    rng = random.Random(seed)
    pairs: List[Dict[str, Any]] = []
    for anchor in items:
        positives = [item for item in items if item["menu_item_id"] != anchor["menu_item_id"] and share_tags(anchor, item)]
        negatives = [item for item in items if item["menu_item_id"] != anchor["menu_item_id"] and not share_tags(anchor, item)]
        if not positives or not negatives:
            continue
        for _ in range(per_item):
            positive = rng.choice(positives)
            negative = rng.choice(negatives)
            pairs.append(
                {
                    "anchor_id": anchor["menu_item_id"],
                    "positive_id": positive["menu_item_id"],
                    "negative_id": negative["menu_item_id"],
                    "anchor": canonical_text(anchor),
                    "positive": canonical_text(positive),
                    "negative": canonical_text(negative),
                }
            )
    return pairs


def write_pairs(pairs: List[Dict[str, Any]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for pair in pairs:
            handle.write(json.dumps(pair, ensure_ascii=False) + "\n")
    print(f"Wrote {len(pairs)} triplets to {path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate similarity triplets from enriched menu data.")
    parser.add_argument("--input", required=True, help="Path to menu_items_enriched.json")
    parser.add_argument("--output", required=True, help="Path to JSONL file with triplets.")
    parser.add_argument("--pairs-per-item", type=int, default=5, help="Triplets to create per anchor item.")
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    items = load_items(Path(args.input))
    if not items:
        raise SystemExit("No items found in input file.")
    pairs = build_pairs(items, args.pairs_per_item, args.seed)
    if not pairs:
        raise SystemExit("Unable to build any triplets. Check that items share tags.")
    write_pairs(pairs, Path(args.output))


if __name__ == "__main__":
    main()
