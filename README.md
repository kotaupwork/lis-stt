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

# 3c. (Phase 3) Run Vosk + STT backend via Docker
make docker-up

# 3d. (Phase 4) Run backend tests
make backend-test

# 3e. Generate sample MP3 files for STT checks
make audio-samples-install
make audio-samples

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
docker-compose.yml       Docker Compose stack for Vosk + backend
Dockerfile               Container image for Python backend
tools/generate_test_audio.py  Script to generate sample mp3 clips
src/public/audio-samples/     Generated sample audio files
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
- `VOSK_DEFAULT_MODEL` (FastAPI backend default model key, default `en`)
- `VOSK_WS_URL_EN` (FastAPI -> English Vosk websocket, default `ws://localhost:2700`)
- `VOSK_WS_URL_SR` (FastAPI -> Serbian Vosk websocket, default `ws://localhost:2701`)
- `VOSK_WS_URL_SH` (FastAPI -> Serbo-Croatian Vosk websocket, default `ws://localhost:2702`)

---

## STT Phase 3 Docker Deployment

- Pull prebuilt images: `docker compose pull`
- Start stack: `make docker-up`
- Inspect services: `make docker-ps`
- View logs: `make docker-logs`
- Stop stack: `make docker-down`

Optional slavic model containers are profile-gated:

- `docker compose --profile sr pull && docker compose --profile sr up -d` (Serbian model container)
- `docker compose --profile sh pull && docker compose --profile sh up -d` (Serbo-Croatian model container)
- `docker compose --profile sr --profile sh pull && docker compose --profile sr --profile sh up -d` (both)

Frontend/backend containers are now expected to come from GitHub Container Registry (GHCR):

- `ghcr.io/kotaupwork/lis-stt/frontend:<tag>`
- `ghcr.io/kotaupwork/lis-stt/backend:<tag>`

Override image tags locally via `.env` (`FRONTEND_IMAGE`, `BACKEND_IMAGE`) if needed.

If upstream download links return 404, keep running with English (`make docker-up`) and override URLs in `.env` (`VOSK_MODEL_URL_SR`, `VOSK_MODEL_URL_SH`) once valid archives are available.

Service endpoints after startup:

- Vosk websocket (English): `ws://localhost:2700`
- Vosk websocket (Serbian, `vosk-model-small-sr-0.4`): `ws://localhost:2701`
- Vosk websocket (Serbo-Croatian, `vosk-model-small-sh-0.4`): `ws://localhost:2702`
- STT backend: `http://localhost:8000`

The STT card now includes a `Vosk Model` dropdown. Selected values (`en`, `sr`, `sh`) are sent on chunk/finalize requests so live and sample transcription use the chosen model.

---

## STT Phase 4 Integration Notes

- Frontend now retries Vosk chunk uploads with short backoff before failing.
- STT UI exposes non-blocking status messages (info/success/warn/error) instead of alerts.
- Backend endpoints guard error paths and return `503` when Vosk is unavailable.
- Backend tests cover:
  - 500ms audio chunking behavior
  - Vosk payload normalization
  - Health and empty-audio transcribe behavior

---

## Sample Audio (Serbian + English)

Generated files:

- `/audio-samples/sr_female.mp3`
- `/audio-samples/sr_male.mp3`
- `/audio-samples/en_female.mp3`
- `/audio-samples/en_male.mp3`

In the UI, each sample has:

- Native playback control
- `Run Through STT` button that decodes MP3 in browser and streams PCM chunks to backend

If generation fails in your environment, record your own clips and place them in `src/public/audio-samples/` with the same filenames.
