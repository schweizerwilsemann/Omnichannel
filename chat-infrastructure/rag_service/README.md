# RAG Service

FastAPI microservice that powers a restaurant FAQ retrieval-augmented generation chatbot. It:

- Embeds reference content with Ollama (`nomic-embed-text`) and writes vectors to Qdrant.
- Retrieves relevant chunks to ground answers generated with Ollama (`mistral:7b-instruct`).
- Caches responses and chat state in Redis, with Lua helpers for atomic updates.
- Provides ingestion and query endpoints consumed by the Customer UI or other services.

## Key Endpoints

| Method | Path              | Description                                      |
| ------ | ----------------- | ------------------------------------------------ |
| POST   | `/rag/ingest`     | Ingest restaurant FAQ or menu documents. (admin) |
| POST   | `/rag/query`      | Retrieve + generate an answer for a prompt.      |
| POST   | `/rag/cache/flush`| Purge cached answers from Redis. (admin)         |
| GET    | `/rag/health`     | Service, Qdrant, Redis connectivity check.       |

## Running Locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Tip: create a dedicated environment with `python3 -m venv .venv` and activate it via `source .venv/bin/activate` before installing dependencies.

Environment variables can be set via `.env` (see `.env.example`).
If the customer UI runs on a different origin, set `CORS_ALLOW_ORIGINS` (comma-separated) so browsers can reach the service from that host.

To restrict ingestion and cache control endpoints, set `RAG_ADMIN_API_KEY`. Clients (like the admin backend) must pass the same value via the `x-rag-admin-key` header when calling `/rag/ingest` or `/rag/cache/flush`.

### Example Requests

```bash
# health check
curl http://localhost:8000/rag/health

# ingest dummy dataset
python scripts/seed_dummy.py

# ask a question
curl -X POST http://localhost:8000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"question":"What are the weekday hours for Pho 24?", "restaurant_id":"pho-24"}'
```

### Integration Notes

- The existing Express backend can proxy `/api/rag/query` → `http://rag-service/rag/query` to keep the UI contracts consistent.
- `fe-customer` chat flows can call the proxy endpoint and surface `answer` plus contextual `sources` metadata for citations.
- Session IDs sent from the UI allow Redis to maintain a `rag:session:{id}` stream for conversation auditing.

## Seeding Dummy Data

```bash
python scripts/seed_dummy.py --input data/dummy_faq.json
```

The service automatically creates the Qdrant collection (`restaurant-faq`) if it does not exist.

## Menu Similarity Pipeline (Sentence-Transformer)

1. **Export + Enrich menu data**
   ```bash
   python scripts/export_menu_items.py --output data/menu_items.json
   python scripts/augment_menu_items.py \
     --input data/menu_items.json \
     --output data/menu_items_enriched.json
   ```

2. **Generate positive/negative triplets**
   ```bash
   python scripts/generate_similarity_pairs.py \
     --input data/menu_items_enriched.json \
     --output data/menu_similarity_pairs.jsonl \
     --pairs-per-item 8
   ```

3. **Fine-tune SentenceTransformer**
   ```bash
   python scripts/train_similarity_model.py \
     --pairs data/menu_similarity_pairs.jsonl \
     --output models/menu-similarity-model \
     --loss mnr --epochs 3 --batch-size 32
   ```

4. **Encode + sync vectors**
   ```bash
   python scripts/sync_menu_vectors.py \
     --input data/menu_items_enriched.json \
     --model-path models/menu-similarity-model \
     --json-output data/menu_vectors.json \
     --qdrant-host localhost --qdrant-port 6333 --qdrant-collection menu_similarity \
     --redis-host localhost --redis-prefix menu: --redis-index idx:menu-similarity
   ```

   Flags are optional—omit `--redis-host` or `--qdrant-host` if you only need JSON export. Use `--qdrant-recreate` / `--redis-recreate` when you want to rebuild the vector collections from scratch.

These scripts make it easy to produce a semantic “similar dishes” encoder that the backend can query to recommend substitutes (filtering by allergens/tags stored in the payload).
