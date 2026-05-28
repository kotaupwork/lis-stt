# Project Status

> **Last updated:** 2026-05-28
> **Version:** 0.1.0-dev → 1.0.0-stt-dev (in progress)

---

## Modules

| Module | Purpose | Status | Notes |
|---|---|---|---|
| `src/logger.ts` | Shared logger | ✅ Done | Colored console + file output; verbosity control |
| `src/config.ts` | Typed env config | ✅ Done | All config via `process.env` |
| `src/index.ts` | Express + route setup | ✅ Done | Full page + htmx fragment endpoints |
| `src/views/index.ejs` | Full page view | ✅ Done | htmx trigger and target container |
| `src/views/partials/time.ejs` | Fragment view | ✅ Done | Rendered by partial route |
| `src/client/audio-recorder.js` | Audio capture + resampling | ✅ Done | MediaRecorder wrapper, 48→16 kHz conversion |
| `src/client/web-speech.js` | Web Speech API wrapper | ✅ Done | Detection + unified result format |
| `src/client/stt-manager.js` | Unified STT interface | ✅ Done | Web Speech API → Vosk fallback |
| `src/client/stt.js` | STT browser initialization | ✅ Done | DOM event handlers, UI integration |
| `backend/app.py` | Python FastAPI server | 🔵 Planned | HTTP + WebSocket routes |
| `backend/vosk_client.py` | Vosk WebSocket client | 🔵 Planned | Stream audio, receive results |
| `backend/session_manager.py` | Session tracking | 🔵 Planned | UUID mapping for recordings |
| `backend/audio_processor.py` | Audio buffering + silence | 🔵 Planned | 500ms buffer, silence detection |

---

## Docs

| File | Status | Notes |
|---|---|---|
| `.github/copilot-instructions.md` | ✅ Done | Critical rules, layout, patterns |
| `docs/STATUS.md` | ✅ Done | This file |
| `docs/SAFEGUARDS.md` | ✅ Done | Error prevention rules |
| `docs/STYLE_EXAMPLES.md` | ✅ Done | Templates, naming conventions |
| `plan.md` | ✅ Done | Feature backlog |
| `.env.example` | ✅ Done | Required env vars with placeholders |
| `.gitignore` | ✅ Done | node_modules/, .env, logs |

---

## Planned Features

| ID | Feature | Status | Notes |
|---|---|---|---|
| A | Full page route (`/`) | ✅ Done | Server-rendered with EJS |
| B | Fragment route (`/partials/time`) | ✅ Done | htmx-compatible partial response |
| C | Health route (`/health`) | ✅ Done | JSON heartbeat for uptime checks |
| D-1 | **Phase 1: Frontend Recording** | ✅ Done | Audio recorder + Web Speech API wrapper |
| D-2 | **Phase 2: Backend STT Endpoints** | 🔵 Planned | FastAPI routes + Vosk client |
| D-3 | **Phase 3: Docker Deployment** | 🔵 Planned | Docker Compose + Vosk service |
| D-4 | **Phase 4: Integration & Testing** | 🔵 Planned | Full cycle testing + edge case handling |

---

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-28 | Used custom `logger.ts` | Consistent log levels, timestamps, file output |
| 2026-05-28 | htmx-first server-rendered template | Practical default for progressive enhancement |
| 2026-05-28 | Hybrid STT: Web Speech API + Vosk fallback | Best UX (native API when available) + always-available fallback (privacy-first) |
| 2026-05-28 | Audio buffering at 500ms | Quality > speed; ~0.5s latency acceptable for voice input |
| 2026-05-28 | HTTP POST (audio) + WebSocket (results) | Clean separation; POST stateless, WebSocket real-time HTMX-native |
| 2026-05-28 | Python FastAPI backend + Docker Vosk | Best Vosk integration; Vosk service isolated; Node.js frontend stays |
