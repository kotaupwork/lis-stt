# Project Plan — HTMX + TypeScript Template

> Live status: see docs/STATUS.md.

---

## Architecture

Server-rendered web app with small htmx interactions:

- Express handles HTTP routes.
- EJS renders both full pages and partial fragments.
- htmx attributes trigger fragment updates without SPA complexity.

### Module Structure

```
src/
  index.ts                app bootstrap + routes
  config.ts               environment config
  logger.ts               shared logger
  views/
    index.ejs             full page
    partials/time.ejs     htmx fragment
  public/styles.css       static asset
```

---

## Features

| ID | File | Description | Status |
|---|---|---|---|
| A | src/index.ts | Express server + health + page + fragment routes | ✅ Done |
| B | src/views/index.ejs | Home page with htmx trigger + target container | ✅ Done |
| C | src/views/partials/time.ejs | Fragment endpoint output | ✅ Done |

---

## Decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-28 | Server-rendered first architecture | Keeps template simple and htmx-native |
| 2026-05-28 | EJS for default view engine | Widely known, minimal setup |
| 2026-05-28 | Keep strict TypeScript settings | Preserve template quality baseline |

---

---

## STT (Speech-to-Text) Feature — Web Speech API + Vosk Failsafe

### Overview

Implement a **hybrid real-time speech-to-text system**:
- **Primary:** Web Speech API (browser-native, instant, no server cost)
- **Fallback:** Vosk (on-premise, always available, offline-capable, privacy-focused)
- **Audio handling:** Browser records → buffers → streams to backend → Vosk processes → results display via WebSocket (HTMX)
- **Quality over speed:** Buffer ~500ms audio chunks before processing for better accuracy

### Architecture

```
Browser (TypeScript + HTMX)
  ├─ MediaRecorder: capture at 48 kHz → resample to 16 kHz mono PCM
  ├─ Try Web Speech API first (Chrome, Edge, Safari)
  ├─ Fall back to Vosk if Web Speech unavailable (Firefox, privacy users)
  ├─ POST audio chunks (160ms @ 16 kHz = 512 bytes) to /api/transcribe
  └─ Listen on WebSocket /ws/transcribe (HTMX div updates)

Backend (Python FastAPI) — NEW
  ├─ HTTP POST /api/transcribe: receive chunks, session tracking
  ├─ Audio buffer: accumulate until 500ms threshold OR silence detected
  ├─ Vosk WebSocket client: stream buffered chunks to local Vosk service
  └─ WebSocket /ws/transcribe: push transcript updates to browser (HTML fragments)

Vosk Service (Docker) — NEW
  └─ Local WebSocket server (port 2700)
     Accepts 16 kHz PCM audio → returns JSON transcription results
```

### Project Structure Extension

```
lis-stt/
  ├── src/
  │   ├── client/                    # NEW: Browser-side STT logic
  │   │   ├── audio-recorder.ts      # MediaRecorder wrapper + resampling
  │   │   ├── web-speech.ts          # Web Speech API wrapper + detection
  │   │   ├── vosk-client.ts         # Vosk client (HTTP upload + WebSocket)
  │   │   ├── stt-manager.ts         # Unified STT interface
  │   │   └── stt.js                 # Browser initialization entry point
  │   ├── views/
  │   │   ├── index.ejs              # Modified: add record button + transcript div
  │   │   └── partials/
  │   │       └── transcript.ejs      # NEW: partial for transcript updates
  │   └── (existing modules remain)
  │
  ├── backend/                       # NEW: Python FastAPI backend
  │   ├── app.py                     # FastAPI setup + routes
  │   ├── vosk_client.py             # Vosk WebSocket client
  │   ├── session_manager.py         # Session tracking
  │   ├── audio_processor.py         # Audio buffering + silence detection
  │   ├── models/                    # Vosk language models
  │   │   └── vosk-model-en-us-0.42/
  │   └── requirements.txt           # Python dependencies
  │
  ├── docker-compose.yml             # NEW: Vosk + backend services
  ├── Dockerfile                     # NEW: Python backend container
  └── (existing files remain)
```

### Implementation Phases

| Phase | Focus | Status |
|-------|-------|--------|
| **1** | Frontend audio recording + Web Speech API | Done |
| **2** | Backend STT endpoints + Vosk integration | Done |
| **3** | Docker deployment + local service setup | Done |
| **4** | Integration testing + edge cases | Not Started |

### Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|----------|
| **Primary STT** | Web Speech API | Native support, instant results, zero server cost |
| **Fallback STT** | Vosk on-premise | Always available, offline, privacy-first |
| **Audio buffer** | 500ms (~3 × 160ms chunks) | Better accuracy; acceptable latency |
| **Backend language** | Python FastAPI | Excellent Vosk bindings; fast async; simple audio processing |
| **Audio upload** | HTTP POST chunks | Stateless; simple; async transcription |
| **Results delivery** | WebSocket (HTMX native) | Real-time updates; seamless integration |
| **Deployment** | Docker (Vosk) + Node.js (backend) | Vosk isolated; backend stays Node.js |
| **Fallback strategy** | Automatic (transparent) | Web Speech API if available, Vosk fallback |

---

## Backlog

- Add request validation helper for form endpoints.
- Add CSRF strategy examples for form posts.
- Add integration tests for fragment routes.
- **STT Phase 5:** Integration with other services (DB storage, JSON/PDF export).
- **STT Phase 6:** Multi-language support (language selector, multiple Vosk models).
- **STT Phase 7:** Audio quality metrics (WER, confidence scores, visualization).
