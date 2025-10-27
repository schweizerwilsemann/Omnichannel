# Guide: Updating Menu Data & Retraining the Similarity Model

This walkthrough shows the exact steps to take whenever you add new menu items (or change descriptions/tags) and want the “Find similar” feature to reflect them.

> **Prereqs:** Python environment with `pip install -r chat-infrastructure/rag_service/requirements.txt`, Qdrant running, backend env set (`QDRANT_HOST`, etc.).

---

## 1. Update Menu Data

Add/edit menu items in the regular system (seeders, admin tools, or direct DB updates). Ensure each dish has a name, description, category, and optional image.

---

## 2. Export Fresh Menu Snapshot

From the repo root:

```bash
cd chat-infrastructure/rag_service
python scripts/export_menu_items.py --output data/menu_items.json
```

This queries `menu_items`/`menu_categories` and produces a JSON list with the latest dishes.

---

## 3. Enrich with Allergens & Tags

`augment_menu_items.py` injects manual tags (spice level, dietary, allergens, contains_alcohol, notes):

```bash
python scripts/augment_menu_items.py \
  --input data/menu_items.json \
  --output data/menu_items_enriched.json
```

If you add entirely new dishes, update the mapping inside the script so each one has meaningful tags/allergen metadata before running the command.

---

## 4. Generate Anchor/Positive/Negative Triplets

Contrastive training needs pairs:

```bash
python scripts/generate_similarity_pairs.py \
  --input data/menu_items_enriched.json \
  --output data/menu_similarity_pairs.jsonl \
  --pairs-per-item 8
```

Feel free to tweak `--pairs-per-item` for larger datasets.

---

## 5. Fine-Tune the Sentence Transformer

```bash
python scripts/train_similarity_model.py \
  --pairs data/menu_similarity_pairs.jsonl \
  --output models/menu-similarity-model \
  --loss mnr \
  --epochs 3 \
  --batch-size 32
```

A new directory `models/menu-similarity-model` (or your custom path) is created with the fine-tuned encoder. Increase epochs if you notice underfitting.

---

## 6. Encode & Sync Vectors

```bash
python scripts/sync_menu_vectors.py \
  --input data/menu_items_enriched.json \
  --model-path models/menu-similarity-model \
  --json-output data/menu_vectors.json \
  --qdrant-host localhost --qdrant-port 6333 --qdrant-collection menu_similarity \
  --redis-host localhost --redis-prefix menu: --redis-index idx:menu-similarity --redis-recreate
```

- JSON output is optional but handy for auditing.
- Remove the Redis flags if you only need Qdrant. The script auto-skips Redis if RediSearch isn’t installed.
- Use `--qdrant-recreate` if you want a clean collection (note it wipes existing vectors).

---

## 7. Restart Backend (if needed)

```bash
pnpm start:be
```

Not strictly required if only vectors change, but restarting ensures any cached collection metadata is refreshed.

---

## 8. Verify

1. Open the customer UI, find a dish, click **“Find similar”**.
2. You should see the updated substitution suggestions (badge tags/allergens) and the ability to add them to the cart.
3. If the modal says “No similar dishes available right now”, double-check:
   - Qdrant collection contains the new IDs (`sync_menu_vectors.py` log should say “Upserted … vectors”).
   - Backend `.env` still points to the correct Qdrant host/collection.

---

## Troubleshooting

| Issue | Fix |
| ----- | ---- |
| Modal says “Similar dish search is not enabled yet.” | Backend couldn’t reach Qdrant (env vars missing or instance down). Check logs for “Qdrant client initialised”. |
| Modal shows “No similar dishes available right now.” even after sync | New items lack tags/allergens, so triplets weren’t generated. Update `augment_menu_items.py` mapping and rerun steps 2–6. |
| Training fails | Ensure `sentence-transformers`, `torch`, and other requirements are installed in the virtualenv. |
| Redis errors during sync | If you’re not running Redis Stack, omit the `--redis-*` flags; the script logs that it skipped Redis. |

---

## Quick Run-All Script (Optional)

After configuring the scripts, you can chain them:

```bash
cd chat-infrastructure/rag_service
python scripts/export_menu_items.py --output data/menu_items.json
python scripts/augment_menu_items.py --input data/menu_items.json --output data/menu_items_enriched.json
python scripts/generate_similarity_pairs.py --input data/menu_items_enriched.json --output data/menu_similarity_pairs.jsonl
python scripts/train_similarity_model.py --pairs data/menu_similarity_pairs.jsonl --output models/menu-similarity-model
python scripts/sync_menu_vectors.py --input data/menu_items_enriched.json --model-path models/menu-similarity-model --json-output data/menu_vectors.json --qdrant-host localhost --qdrant-port 6333 --qdrant-collection menu_similarity
```

Automate this with a cron job whenever menu data changes significantly.

---

By following this sequence every time you add or modify dishes, the semantic similarity model and the “Find similar” button stay perfectly in sync with your actual menu.
