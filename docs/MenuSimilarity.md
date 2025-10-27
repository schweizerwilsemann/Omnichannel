# Menu Similarity Service – Concept to Delivery

This document explains the end-to-end “Find similar dishes” feature that augments the Apriori-based recommendations. It covers the ML idea, dataset preparation, model training, serving topology, and how the backend/front-end consume the vectors.

---

## 1. Motivation

Apriori upsells (“People also added…”) depend on order co-occurrence. They work best near checkout because they need cart context. We wanted:

- **Menu browsing help** – When a guest opens an item, surface alternative dishes with comparable flavor profile/dietary traits even if there’s no historical attach data.
- **Allergen-friendly substitutions** – Quickly find gluten-free or nut-free variants within the same restaurant.
- **Cold-start capability** – New restaurants can still show smart suggestions the moment the menu is onboarded.

This is a semantic problem: match dishes by description, ingredients, and tags. So we build a **metric-learning similarity model** that encodes every menu item into vector space, then query nearest neighbours inside Qdrant.

---

## 2. Data Sourcing & Enrichment

### 2.1 Export

`scripts/export_menu_items.py` (in `chat-infrastructure/rag_service`) queries `menu_items` + `menu_categories` to produce a JSON payload containing:

- `menu_item_id`, `name`, `description`, `category_name`
- `price_cents`, `image_url`, `restaurant_name`

### 2.2 Manual-enrichment script

`scripts/augment_menu_items.py` reads the export and injects curated attributes for each dish:

- `key_ingredients`
- `spice_level`
- `dietary_tags` (vegetarian, contains-shellfish, etc.)
- `allergens` (gluten, dairy, tree-nut…)
- `contains_alcohol`
- Optional notes

The output `data/menu_items_enriched.json` becomes the canonical dataset. These tags are what make the ML labels meaningful.

---

## 3. Pair Generation & ML Objective

To teach a sentence transformer which dishes “belong together”, we generate triplets:

- `anchor`: description + tags of a dish
- `positive`: another dish sharing at least one tag/spice level/allergen profile
- `negative`: a dish with disjoint tags (different dietary/allergen profile)

`generate_similarity_pairs.py` automates this, writing JSONL rows of `{"anchor","positive","negative"}` text.

### Contrastive Fine-tuning

- Base model: `sentence-transformers/all-MiniLM-L6-v2` (384-dim embeddings).
- Loss: `MultipleNegativesRankingLoss` (default) or `TripletLoss`.
- Input text: concatenation of name, category, description, ingredient list, tags, allergens, spice level, contains-alcohol flag. This ensures the encoded vector reflects both flavor and dietary info.

`train_similarity_model.py --pairs data/menu_similarity_pairs.jsonl --output models/menu-similarity-model` produces a fine-tuned encoder directory. No backend changes required—just drop in a new model when you retrain.

---

## 4. Vector Sync & Storage

`sync_menu_vectors.py` loads the trained model, encodes every menu item, and:

1. Optionally dumps `data/menu_vectors.json` for audits.
2. Upserts vectors and payload into **Qdrant** (`menu_similarity` collection) with COSINE distance.
3. Tries to sync to Redis Stack (FLAT index) if available; gracefully skips if RediSearch isn’t installed.

Each payload includes the original metadata (tags, allergens, etc.). That lets the backend filter by restaurant, exclude certain menu IDs, or extend to other filters in the future.

> Re-run this script whenever menu definitions or the ML model change. Qdrant now holds the authoritative embedding store; backend doesn’t do any heavy computation.

---

## 5. Serving Architecture

### 5.1 Backend

- `.env` now supports:
  ```
  QDRANT_HOST=localhost
  QDRANT_PORT=6333
  QDRANT_API_KEY=
  QDRANT_COLLECTION=menu_similarity
  QDRANT_USE_TLS=false
  ```
- `be/src/config/qdrant.js` instantiates `@qdrant/js-client-rest` if host is provided.
- `getSimilarMenuItems()` in `recommendation.service.js`:
  - Validates session → obtains `restaurantId`.
  - Calls `qdrantClient.recommend()` with `positive=[menuItemId]`, filters payload to same restaurant, excludes the base item, caps results at 5.
  - Returns normalized items (`id`, `name`, `description`, `priceCents`, `dietaryTags`, `allergens`, `spiceLevel`, `containsAlcohol`, `similarityScore`).
- Exposed via `GET /customer/menu/similar?sessionToken=…&menuItemId=…&limit=5`. If Qdrant isn’t configured, the endpoint responds with `{ items: [], available: false }` so the front-end can display a fallback message.

### 5.2 Front-end (Customer)

- `MenuPage` shows a “Find similar” secondary action on each menu card.
- Clicking the button triggers `fetchSimilarMenuItems()` (Axios call to the new endpoint).
- A modal appears showing:
  - Title `Similar to <dish>`
  - Badge list of dietary tags and spice level
  - Similarity percentage (if available)
  - “Add” buttons that push the selected dish straight into the cart.

If Qdrant returns no matches, the modal explains there are currently no similar dishes. If Qdrant is disabled, it explains that the feature isn’t enabled.

### 5.3 Coexistence with Apriori

This similarity pipeline is complementary. Apriori still drives “Recommended for you” in checkout (attach-rate). The new vector search enhances menu browsing and substitution use cases, especially when there isn’t enough transactional history for Apriori to learn from.

---

## 6. Ops Checklist

| Step | Command |
| ---- | ------- |
| Export menu | `python scripts/export_menu_items.py --output data/menu_items.json` |
| Enrich tags | `python scripts/augment_menu_items.py --input data/menu_items.json --output data/menu_items_enriched.json` |
| Generate pairs | `python scripts/generate_similarity_pairs.py --input data/menu_items_enriched.json --output data/menu_similarity_pairs.jsonl --pairs-per-item 8` |
| Fine-tune | `python scripts/train_similarity_model.py --pairs data/menu_similarity_pairs.jsonl --output models/menu-similarity-model --loss mnr --epochs 3` |
| Sync vectors | `python scripts/sync_menu_vectors.py --input data/menu_items_enriched.json --model-path models/menu-similarity-model --qdrant-host localhost --qdrant-port 6333 --qdrant-collection menu_similarity --json-output data/menu_vectors.json` |
| Backend restart | `pnpm start:be` (so it picks up Qdrant env vars) |
| Front-end | `pnpm start:fe-customer` (already wired to call `/customer/menu/similar`) |

---

## 7. Future Enhancements

- Combine similarity score with Apriori attach-rate (e.g., `hybrid_score = 0.6 * cosine + 0.4 * attachRate`).
- Add query filters (e.g., only show vegetarian matches when a guest flags dietary preferences).
- Use the same embeddings for text search (“show me spicy seafood”) via semantic query vectors.
- Introduce pipeline automation (cron job or CI) to refresh embeddings when menu data changes.

For now the workflow gives a practical ML-driven feature with clear steps to maintain, while remaining decoupled from the real-time backend.
