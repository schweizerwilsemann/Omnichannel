# Smart Menu Search – Architecture & Playbook

## 1. Goals
- Let guests describe cravings with plain language and receive curated dishes for the current restaurant/table.
- Blend semantic recall (vector similarity) with domain heuristics so we can respect dietary filters, spice preferences, and menu metadata.
- Detect ambiguous requests, ask the guest for clarification, and capture those interactions for analysis and future model training.

## 2. System Overview
```
Customer UI  ──>  /customer/menu/search  ──┐
                                           │
                                ┌─>  Embedding service (/rag/embed)
                                │
Backend (Node.js)  ──>  Qdrant vector store ──>  Menu DB + enrichment JSON
                                │
                                └─>  menu_query_logs / candidates / clarifications
```
Key modules:
- **`menuSearch.service.js`** – orchestrates query parsing, vector recall, heuristic scoring, and logging.
- **Embedding microservice** (`chat-infrastructure/rag_service`) – exposes `/rag/embed`, returning vectors via Ollama (or another model).
- **Qdrant** – stores menu-item embeddings (`menu_similarity` collection) keyed by `menu_item_id`.
- **Clarification storage** – Sequelize models + migration `014-create-menu-query-logs.js` keep every query/candidate/clarification.

## 3. Search Pipeline (Backend)
1. **Session lookup** – verify the guest session is active and scoped to a restaurant.
2. **Tokenisation & intent extraction** – remove stop words, map keywords to high-level intents:
   - Course craving (beverage, dessert, appetizer, salad, soup, pasta, entrée).
   - Temperature (cold vs warm) and spice preference.
   - Alcohol allowance, dietary requirements, allergens to avoid.
   - Ingredient focus (seafood, steak, chicken, pasta, salad, soup, dessert).
3. **Semantic recall** – embed the query through `/rag/embed` and call Qdrant search. Results are cached and attached as metadata for logging.
4. **Candidate generation** – load every available menu item + enrichment JSON (dietary tags, allergens, spice level, key ingredients).
5. **Heuristic filtering** – throw out items that break hard rules (vegetarian query vs meat keywords, gluten-free vs gluten allergen, alcohol-free vs boozy cocktails, etc.).
6. **Scoring** – combine:
   - `vectorScore * VECTOR_WEIGHT` (currently 5.5) to reward semantic hits.
   - Token overlap, course alignment, spice/temperature matches.
   - Ingredient focus bonuses and dietary compliance.
7. **Ranking & thresholding** – discard anything below 0.5 (or 0.05 if it came from vector recall), sort by score, break ties alphabetically, cap at requested limit (1–12).
8. **Response assembly** – include item basics, enrichment, `matchScore`, `matchReasons`, optional `similarityScore`, plus `ambiguityScore`, `needsClarification`, and `clarificationPrompt`.
9. **Logging** – write to `menu_query_logs` and `menu_query_candidates` (with recall & final scores). If clarification is needed, insert a row into `menu_query_clarifications` with the generated question/options.

## 4. Clarification Workflow
- **Ambiguity detection** – compare top-1 vs top-2 scores; if the ratio ≥ 0.75 (or query is a single token), flag ambiguity.
- **Prompt generation** – `buildClarificationDetails` crafts an English prompt (e.g., “Would you like to focus on Beverages or Wine & Cocktails?”) using top categories or ingredient hints.
- **Frontend UX** (`MenuSearch.jsx`):
  - Displays the clarification banner (“Need more detail?”) with chips for suggested options.
  - Allows free-form input; submission calls `POST /customer/menu/search/clarify`.
- **Clarify endpoint** – appends the guest’s answer to the base query, reruns the search, marks the log as `CLARIFIED`, and stores the response for analytics.

## 5. Data Model & Tables
| Table | Purpose | Notable Columns |
| --- | --- | --- |
| `menu_query_logs` | Per-search metadata | `raw_query`, `normalized_query`, `tokens`, `intents`, `ambiguity_score`, `top_score`, `second_score`, `metadata` (vector stats, clarification info), `resolution_status`, `resolved_item_id` |
| `menu_query_candidates` | Scored candidates | `recall_score` (vector), `final_score`, `reasons`, `selected` |
| `menu_query_clarifications` | Clarification prompts/replies | `question_text`, `user_reply`, `metadata.options`, `resolved_at` |

This schema lets us audit ambiguous phrasing, label data for model fine-tuning, and measure clarification effectiveness.

## 6. Implementation Checklist
1. **Environment vars (`be/.env`):**
   ```ini
   QDRANT_HOST=localhost
   QDRANT_PORT=6333
   QDRANT_COLLECTION=menu_similarity
   EMBEDDING_SERVICE_URL=http://localhost:8081/
   EMBEDDING_SERVICE_API_KEY=rag_admin_secret_key
   MENU_ENRICHMENT_PATH=/abs/path/to/menu_items_enriched.json
   ```
2. **Install dependencies:**
   ```bash
   pnpm install              # backend
   pip install -r chat-infrastructure/rag_service/requirements.txt
   ```
3. **Run embedding service:**
   ```bash
   cd chat-infrastructure/rag_service
   uvicorn app.main:app --host 0.0.0.0 --port 8081
   ```
4. **Sync vectors into Qdrant (using the live embedding service):**
   ```bash
   python chat-infrastructure/rag_service/scripts/sync_menu_vectors.py \
     --input chat-infrastructure/rag_service/data/menu_items_enriched.json \
     --embed-endpoint http://localhost:8081/rag/embed \
     --embed-key rag_admin_secret_key \
     --qdrant-host localhost --qdrant-port 6333 \
     --qdrant-collection menu_similarity --qdrant-recreate
   ```
   - If you prefer offline encoding, swap to `--model-path <hf-model>`; both query and data must use the same model dimension.
5. **Create tables:** `pnpm --filter ./be run migrate`
6. **Start services:**
   ```bash
   pnpm start:be
   pnpm --filter ./fe-customer run start
   ```

## 7. Testing & Validation
- **Manual API test:**
  ```bash
  curl -G http://localhost:3301/customer/menu/search \
    --data-urlencode "sessionToken=<token>" \
    --data-urlencode "query=spicy vegetarian pasta"
  ```
- **Clarification loop:** Trigger an ambiguous query (e.g., “wine for dinner”), note the `clarificationId`, then:
  ```bash
  curl -X POST http://localhost:3301/customer/menu/search/clarify \
    -H "Content-Type: application/json" \
    -d '{"sessionToken":"<token>","clarificationId":"<uuid>","answer":"non-alcoholic"}'
  ```
- **Database sanity:** Inspect `menu_query_logs` to confirm English prompts, vector metadata, and final selection. Ensure collection stats in Qdrant (`curl http://localhost:6333/collections/menu_similarity`).

## 8. Monitoring & Next Steps
- Build dashboards for ambiguity rate, clarification success, top failing queries.
- Use logged clarifications as labelled data to fine-tune embeddings or train an intent classifier.
- Consider adding a reranker microservice (cross-encoder / LLM) writing `rerank_score` into `menu_query_candidates`.
- Periodically rerun the vector sync script whenever menu enrichment changes.

## 9. Clarification Predictor Service (optional)
- Train the notebook pipeline (`chat-infrastructure/rag_service/notebooks/menu_query_training/…`) to produce `clarification_model.joblib`, then start the FastAPI service (`uvicorn app.main:app --host 0.0.0.0 --port 8081`) with `CLARIFICATION_MODEL_PATH` pointing at the artifact.
- Add the following env vars to the Node backend (`be/.env`):
  ```
  CLARIFICATION_MODEL_URL=http://localhost:8081/clarification/predict
  CLARIFICATION_MODEL_ADMIN_KEY=rag_admin_secret_key
  CLARIFICATION_MODEL_TIMEOUT_MS=1200
  CLARIFICATION_MODEL_PROB_THRESHOLD=0.6
  ```
- Example integration inside `menuSearch.service.js` once you have `tokens` and `intents` (pseudocode):
  ```js
  import { scoreClarification } from './clarificationPredictor.service.js';

  const features = {
    token_count: tokens.length,
    has_answer_in_options: 0,
    answer_length: trimmed.length,
    intent_courses: intents.courses.size > 0 ? 1 : 0,
    intent_temperature: intents.temperature ? 1 : 0,
    intent_spice: intents.spice ? 1 : 0,
    intent_alcoholPreference: intents.alcoholPreference === true ? 1 : 0,
    intent_requireDietary: intents.requireDietary.size > 0 ? 1 : 0,
    intent_avoidAllergens: intents.avoidAllergens.size > 0 ? 1 : 0,
    intent_ingredientFocus: intents.ingredientFocus.size > 0 ? 1 : 0
  };

  const modelResult = await scoreClarification(features);
  if (modelResult && modelResult.probability >= 0.6) {
    needsClarification = true;
  }
  ```
- Make the call optional: only invoke the predictor when `CLARIFICATION_MODEL_URL` is defined, fall back to the heuristic ambiguity logic on failure, and log `modelResult` alongside existing analytics for offline evaluation.

---
This document captures the current implementation and how to reproduce the full pipeline end-to-end. Update it if the embedding model, vector weight, or clarification logic changes.
