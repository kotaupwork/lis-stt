from __future__ import annotations

import os
import asyncio

from fastapi import HTTPException

from fastapi import FastAPI, File, Form, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import websockets

from .audio_processor import AudioProcessor
from .session_manager import SessionManager
from .vosk_client import VoskClient

app = FastAPI(title="lis-stt backend", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

session_manager = SessionManager()
audio_processor = AudioProcessor(sample_rate=16_000, chunk_ms=500)
default_model = os.getenv("VOSK_DEFAULT_MODEL", "en")
vosk_model_urls: dict[str, str] = {
    "en": os.getenv("VOSK_WS_URL_EN", os.getenv("VOSK_WS_URL", "ws://localhost:2700")),
    "sr": os.getenv("VOSK_WS_URL_SR", "ws://localhost:2701"),
    "sh": os.getenv("VOSK_WS_URL_SH", "ws://localhost:2702"),
}
vosk_clients: dict[str, VoskClient] = {
    model: VoskClient(url=url) for model, url in vosk_model_urls.items()
}
session_models: dict[str, str] = {}


def resolve_model(requested_model: str | None, session_id: str) -> str:
    if requested_model:
        normalized = requested_model.strip().lower()
        if normalized not in vosk_clients:
            allowed = ", ".join(sorted(vosk_clients.keys()))
            raise HTTPException(status_code=400, detail=f"Unknown model '{normalized}'. Allowed: {allowed}")
        session_models[session_id] = normalized
        return normalized

    if session_id in session_models:
        return session_models[session_id]

    session_models[session_id] = default_model
    return default_model


async def is_vosk_available(url: str) -> bool:
    try:
        ws = await asyncio.wait_for(websockets.connect(url, max_size=None), timeout=1.2)
        await ws.close()
        return True
    except Exception:
        return False


@app.get("/health")
async def health() -> dict:
    model_health: dict[str, dict[str, str | bool]] = {}
    for model, url in vosk_model_urls.items():
        model_health[model] = {
            "url": url,
            "ready": await is_vosk_available(url),
        }

    default_meta = model_health.get(default_model, {"url": None, "ready": False})
    return {
        "ok": True,
        "service": "lis-stt-backend",
        "vosk_default_model": default_model,
        "vosk_models": model_health,
        # Backward-compatible fields used by older frontend code.
        "vosk_ws_url": default_meta["url"],
        "vosk_ready": default_meta["ready"],
        "vosk_language": default_model,
    }


@app.post("/api/transcribe")
async def transcribe_chunk(
    audio: UploadFile = File(...),
    session_id: str | None = Form(default=None),
    model: str | None = Form(default=None),
) -> dict:
    resolved_session = session_manager.ensure_session(session_id)
    resolved_model = resolve_model(model, resolved_session)
    vosk_client = vosk_clients[resolved_model]
    payload = await audio.read()

    if not payload:
        return {
            "ok": True,
            "sessionId": resolved_session,
            "model": resolved_model,
            "bufferedBytes": 0,
            "resultsSent": 0,
        }

    results_sent = 0
    try:
        for chunk in audio_processor.append(resolved_session, payload):
            results = await vosk_client.send_audio(resolved_session, chunk)
            for item in results:
                await session_manager.publish(resolved_session, item)
                results_sent += 1
    except Exception as exc:
        await session_manager.publish(
            resolved_session,
            {
                "source": "vosk",
                "isFinal": False,
                "interim": "",
                "final": "",
                "confidence": 0.0,
                "error": f"transcribe_chunk_failed: {exc}",
            },
        )
        raise HTTPException(
            status_code=503,
            detail=f"Vosk transcription unavailable for model '{resolved_model}' at {vosk_client.url}",
        ) from exc

    return {
        "ok": True,
        "sessionId": resolved_session,
        "model": resolved_model,
        "bufferedBytes": len(payload),
        "resultsSent": results_sent,
    }


@app.post("/api/transcribe/finalize")
async def finalize_transcription(
    session_id: str = Form(...),
    model: str | None = Form(default=None),
) -> dict:
    resolved_session = session_manager.ensure_session(session_id)
    resolved_model = resolve_model(model, resolved_session)
    vosk_client = vosk_clients[resolved_model]

    remaining = audio_processor.flush(resolved_session)
    results_sent = 0

    try:
        if remaining:
            results = await vosk_client.send_audio(resolved_session, remaining)
            for item in results:
                await session_manager.publish(resolved_session, item)
                results_sent += 1

        final_results = await vosk_client.finalize(resolved_session)
        for item in final_results:
            await session_manager.publish(resolved_session, item)
            results_sent += 1
    except Exception as exc:
        await session_manager.publish(
            resolved_session,
            {
                "source": "vosk",
                "isFinal": False,
                "interim": "",
                "final": "",
                "confidence": 0.0,
                "error": f"finalize_failed: {exc}",
            },
        )
        raise HTTPException(
            status_code=503,
            detail=f"Vosk finalize unavailable for model '{resolved_model}' at {vosk_client.url}",
        ) from exc
    finally:
        session_models.pop(resolved_session, None)

    return {
        "ok": True,
        "sessionId": resolved_session,
        "model": resolved_model,
        "resultsSent": results_sent,
    }


@app.websocket("/ws/transcribe/{session_id}")
async def ws_transcribe(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    await session_manager.connect(session_id, websocket)

    try:
        while True:
            # Keep socket alive and allow future client control messages.
            await websocket.receive_text()
    except WebSocketDisconnect:
        await session_manager.disconnect(session_id, websocket)
    except Exception:
        await session_manager.disconnect(session_id, websocket)
