from __future__ import annotations

import os

from fastapi import FastAPI, File, Form, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from audio_processor import AudioProcessor
from session_manager import SessionManager
from vosk_client import VoskClient

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
vosk_client = VoskClient(url=os.getenv("VOSK_WS_URL", "ws://localhost:2700"))


@app.get("/health")
async def health() -> dict:
    return {
        "ok": True,
        "service": "lis-stt-backend",
        "vosk_ws_url": vosk_client.url,
    }


@app.post("/api/transcribe")
async def transcribe_chunk(
    audio: UploadFile = File(...),
    session_id: str | None = Form(default=None),
) -> dict:
    resolved_session = session_manager.ensure_session(session_id)
    payload = await audio.read()

    results_sent = 0
    for chunk in audio_processor.append(resolved_session, payload):
        results = await vosk_client.send_audio(resolved_session, chunk)
        for item in results:
            await session_manager.publish(resolved_session, item)
            results_sent += 1

    return {
        "ok": True,
        "sessionId": resolved_session,
        "bufferedBytes": len(payload),
        "resultsSent": results_sent,
    }


@app.post("/api/transcribe/finalize")
async def finalize_transcription(session_id: str = Form(...)) -> dict:
    resolved_session = session_manager.ensure_session(session_id)

    remaining = audio_processor.flush(resolved_session)
    results_sent = 0

    if remaining:
        results = await vosk_client.send_audio(resolved_session, remaining)
        for item in results:
            await session_manager.publish(resolved_session, item)
            results_sent += 1

    final_results = await vosk_client.finalize(resolved_session)
    for item in final_results:
        await session_manager.publish(resolved_session, item)
        results_sent += 1

    return {
        "ok": True,
        "sessionId": resolved_session,
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
