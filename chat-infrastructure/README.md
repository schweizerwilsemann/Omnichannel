# Chat Infrastructure on WSL

End-to-end guide for running the `chat-infrastructure/rag_service` inside Windows Subsystem for Linux (WSL). The steps assume Windows 11 with an Ubuntu 22.04 distribution, but they work for any recent WSL2 distro once you adapt the package manager commands.

## 1. Prerequisites
- Install **WSL2** and an Ubuntu distro (`wsl --install -d Ubuntu`).
- Inside Ubuntu, keep packages current:
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```
- Install tooling required to build Python wheels and talk to system services:
  ```bash
  sudo apt install -y python3 python3-venv python3-pip build-essential pkg-config libffi-dev curl
  ```
- **Docker Desktop (Windows)** with WSL integration enabled is the simplest way to run Qdrant in WSL. Once enabled, the `docker` CLI is available inside Ubuntu.
- Optional but recommended: enable systemd inside WSL (`/etc/wsl.conf`) so `redis-server` can run as a service. On recent WSL builds this is enabled by default.

## 2. Project Checkout
From within Ubuntu, clone or navigate to the repository mounted from Windows:
```bash
cd /mnt/e/omnichannel/omnichannel/chat-infrastructure/rag_service
```

> If you clone inside WSL, prefer a Linux filesystem path (e.g. `~/workspace/omnichannel`) for better performance.

## 3. Python Environment
Create an isolated virtual environment and install the FastAPI service requirements:
```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 4. Runtime Dependencies

### Redis (cache + session store)
```bash
sudo apt install -y redis-server
sudo service redis-server start
redis-cli ping  # should print PONG
```

### Qdrant (vector database)
Run Qdrant with Docker Desktop from inside WSL:
```bash
docker pull qdrant/qdrant:latest
docker run --name qdrant \
  -p 6333:6333 -p 6334:6334 \
  -v qdrant_storage:/qdrant/storage \
  qdrant/qdrant:latest
```

> The service expects Qdrant on `localhost:6333`. The named volume keeps embeddings between restarts.

### Ollama (embedding + generation models)
Install Ollama inside WSL and download the required models:
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull nomic-embed-text
ollama pull mistral:7b-instruct
```
Start the Ollama daemon (if it is not already running in the background):
```bash
ollama serve &
```

## 5. Environment Variables
Copy the example configuration and adjust only if your services run on different ports:
```bash
cp .env.example .env
```
The defaults use `localhost` endpoints for Redis, Qdrant, and Ollama, matching the instructions above.

## 6. Running the Service
With the virtual environment active and dependencies running:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8081
```
The API is now reachable at `http://localhost:8081/rag`.

## 7. Smoke Tests
- Health check:
  ```bash
  curl http://localhost:8081/rag/health
  ```
- Seed the dummy FAQ dataset (requires the dependencies above):
  ```bash
  python scripts/seed_dummy.py
  ```
- Ask a sample question:
  ```bash
  curl -X POST http://localhost:8081/rag/query \
    -H "Content-Type: application/json" \
    -d '{"question":"What are the weekday hours for Pho 24?", "restaurant_id":"pho-24"}'
  ```

## 8. Common WSL Notes
- **Ports**: WSL shares the Windows network stack, so services bound to `0.0.0.0` are reachable from Windows at `localhost`.
- **Long-running services**: For Redis and Ollama, consider adding `redis-server` and `ollama serve` to your WSL profile or using systemd units so they survive shell restarts.
- **Performance**: Heavy model loading needs ample RAM. Allocate at least 8 GB to WSL in `.wslconfig` if you see out-of-memory errors when Ollama loads `mistral:7b-instruct`.

