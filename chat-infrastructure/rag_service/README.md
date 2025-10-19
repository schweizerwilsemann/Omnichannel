# RAG Service

FastAPI microservice that powers a restaurant FAQ retrieval-augmented generation chatbot. It:

- Embeds reference content with Ollama (`nomic-embed-text`) and writes vectors to Qdrant.
- Retrieves relevant chunks to ground answers generated with Ollama (`mistral:7b-instruct`).
- Caches responses and chat state in Redis, with Lua helpers for atomic updates.
- Provides ingestion and query endpoints consumed by the Customer UI or other services.

## Key Endpoints

| Method | Path          | Description                                 |
| ------ | ------------- | ------------------------------------------- |
| POST   | `/rag/ingest` | Ingest restaurant FAQ or menu documents.    |
| POST   | `/rag/query`  | Retrieve + generate an answer for a prompt. |
| GET    | `/rag/health` | Service, Qdrant, Redis connectivity check.  |

## Running Locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Tip: create a dedicated environment with `python3 -m venv .venv` and activate it via `source .venv/bin/activate` before installing dependencies.

Environment variables can be set via `.env` (see `.env.example`).

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
