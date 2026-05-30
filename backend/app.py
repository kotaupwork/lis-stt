from __future__ import annotations

import os
import asyncio
import math
import struct

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
    "en_small": os.getenv("VOSK_WS_URL_EN_SMALL", "ws://localhost:2703"),
    "en_large": os.getenv("VOSK_WS_URL_EN_LARGE", "ws://localhost:2704"),
    "sr": os.getenv("VOSK_WS_URL_SR", "ws://localhost:2701"),
    "sh": os.getenv("VOSK_WS_URL_SH", "ws://localhost:2702"),
}
vosk_clients: dict[str, VoskClient] = {
    model: VoskClient(url=url) for model, url in vosk_model_urls.items()
}
session_models: dict[str, str] = {}
session_sensitivity: dict[str, str] = {}

SENSITIVITY_PRESETS: dict[str, dict[str, int]] = {
    # Higher sensitivity keeps more quiet speech and uses a larger analysis window.
    "high": {"chunk_ms": 650, "min_rms": 180},
    "balanced": {"chunk_ms": 500, "min_rms": 420},
    # Lower sensitivity requires louder speech and shorter windows.
    "low": {"chunk_ms": 350, "min_rms": 750},
}


def resolve_sensitivity(requested_sensitivity: str | None, session_id: str) -> str:
    if requested_sensitivity:
        normalized = requested_sensitivity.strip().lower()
        if normalized not in SENSITIVITY_PRESETS:
            allowed = ", ".join(sorted(SENSITIVITY_PRESETS.keys()))
            raise HTTPException(status_code=400, detail=f"Unknown sensitivity '{normalized}'. Allowed: {allowed}")
        session_sensitivity[session_id] = normalized
        return normalized

    if session_id in session_sensitivity:
        return session_sensitivity[session_id]

    session_sensitivity[session_id] = "balanced"
    return "balanced"


def calculate_pcm_rms(pcm_bytes: bytes) -> float:
    if not pcm_bytes or len(pcm_bytes) < 2:
        return 0.0

    # Ignore trailing odd byte if present.
    usable_len = len(pcm_bytes) - (len(pcm_bytes) % 2)
    sample_count = usable_len // 2
    if sample_count == 0:
        return 0.0

    samples = struct.unpack(f"<{sample_count}h", pcm_bytes[:usable_len])
    mean_square = sum(sample * sample for sample in samples) / sample_count
    return math.sqrt(mean_square)


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
        "sensitivity_presets": SENSITIVITY_PRESETS,
        "default_sensitivity": "balanced",
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
    sensitivity: str | None = Form(default=None),
) -> dict:
    resolved_session = session_manager.ensure_session(session_id)
    resolved_model = resolve_model(model, resolved_session)
    resolved_sensitivity = resolve_sensitivity(sensitivity, resolved_session)
    sensitivity_cfg = SENSITIVITY_PRESETS[resolved_sensitivity]
    vosk_client = vosk_clients[resolved_model]
    payload = await audio.read()

    if not payload:
        return {
            "ok": True,
            "sessionId": resolved_session,
            "model": resolved_model,
            "sensitivity": resolved_sensitivity,
            "bufferedBytes": 0,
            "resultsSent": 0,
        }

    chunk_rms = calculate_pcm_rms(payload)
    if chunk_rms < sensitivity_cfg["min_rms"]:
        return {
            "ok": True,
            "sessionId": resolved_session,
            "model": resolved_model,
            "sensitivity": resolved_sensitivity,
            "bufferedBytes": len(payload),
            "resultsSent": 0,
            "skippedQuietAudio": True,
            "chunkRms": round(chunk_rms, 2),
        }

    results_sent = 0
    try:
        for chunk in audio_processor.append(resolved_session, payload, chunk_ms=sensitivity_cfg["chunk_ms"]):
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
        "sensitivity": resolved_sensitivity,
        "bufferedBytes": len(payload),
        "resultsSent": results_sent,
        "chunkRms": round(chunk_rms, 2),
    }


@app.post("/api/transcribe/finalize")
async def finalize_transcription(
    session_id: str = Form(...),
    model: str | None = Form(default=None),
    sensitivity: str | None = Form(default=None),
) -> dict:
    resolved_session = session_manager.ensure_session(session_id)
    resolved_model = resolve_model(model, resolved_session)
    resolved_sensitivity = resolve_sensitivity(sensitivity, resolved_session)
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
        session_sensitivity.pop(resolved_session, None)

    return {
        "ok": True,
        "sessionId": resolved_session,
        "model": resolved_model,
        "sensitivity": resolved_sensitivity,
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
