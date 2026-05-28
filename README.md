# HTMX + TypeScript Template

Server-rendered starter with Express, EJS views, and htmx-friendly route patterns.

---

## Quick Start

```bash
# 1. Install dependencies
make install

# 2. Copy .env.example to .env and fill in values
cp .env.example .env

# 3. Run in development mode
make dev

# 3b. (Phase 2 fallback) Run STT backend for Vosk mode
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload

# 4. Validate types/lint
make build
make lint
```

Open http://localhost:3000 in your browser.

---

## Project Layout

```
src/
  index.ts               App setup and routes
  config.ts              Environment config
  logger.ts              Shared logger
  public/
    styles.css           Base styling
  views/
    index.ejs            Full page response
    partials/
      time.ejs           HTMX fragment response
    backend/                 Python STT backend (FastAPI + Vosk websocket client)
docs/                    Developer documentation
tests/                   Test suite placeholder
logs/                    Runtime logs
```

See [plan.md](plan.md) for feature roadmap (including STT with Web Speech API + Vosk), and [docs/STATUS.md](docs/STATUS.md) for implementation status.

---

## HTMX Pattern In This Template

- Full page route: `GET /`
- Fragment route: `GET /partials/time`
- Client action: `hx-get="/partials/time" hx-target="#time-box"`

Use this pattern to build interactive server-rendered features with minimal client JavaScript.

---

## STT Phase 2 Backend

- HTTP chunk endpoint: `POST /api/transcribe`
- Finalize endpoint: `POST /api/transcribe/finalize`
- Result stream: `WS /ws/transcribe/{session_id}`
- Health endpoint: `GET /health`

Environment variables used by frontend/backend:

- `STT_BACKEND_URL` (Node app, default `http://localhost:8000`)
- `VOSK_WS_URL` (FastAPI backend, default `ws://localhost:2700`)
