from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from typing import Any

import websockets


class VoskClient:
    """Streaming client for Vosk websocket server."""

    def __init__(self, url: str = "ws://localhost:2700") -> None:
        self.url = url
        self._connections: dict[str, websockets.WebSocketClientProtocol] = {}
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def _ensure_connection(self, session_id: str) -> websockets.WebSocketClientProtocol:
        if session_id in self._connections:
            return self._connections[session_id]

        ws = await websockets.connect(self.url, max_size=None)
        await ws.send(json.dumps({"config": {"sample_rate": 16000}}))
        self._connections[session_id] = ws
        return ws

    async def send_audio(self, session_id: str, pcm_chunk: bytes) -> list[dict[str, Any]]:
        if not pcm_chunk:
            return []

        lock = self._locks[session_id]
        async with lock:
            ws = await self._ensure_connection(session_id)
            await ws.send(pcm_chunk)
            return await self._read_ready_messages(ws)

    async def finalize(self, session_id: str) -> list[dict[str, Any]]:
        lock = self._locks[session_id]
        async with lock:
            ws = await self._ensure_connection(session_id)
            await ws.send(json.dumps({"eof": 1}))
            results = await self._read_ready_messages(ws, timeout=0.5)
            await ws.close()
            self._connections.pop(session_id, None)
            return results

    async def _read_ready_messages(
        self, ws: websockets.WebSocketClientProtocol, timeout: float = 0.03
    ) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = []

        while True:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
            except asyncio.TimeoutError:
                break

            try:
                data = json.loads(raw)
            except Exception:
                continue

            normalized = self._normalize_result(data)
            if normalized:
                messages.append(normalized)

        return messages

    @staticmethod
    def _normalize_result(data: dict[str, Any]) -> dict[str, Any] | None:
        # Vosk emits partial or final payloads.
        partial = data.get("partial", "")
        if partial:
            return {
                "source": "vosk",
                "isFinal": False,
                "interim": partial,
                "final": "",
                "confidence": 0.0,
            }

        text = data.get("text", "")
        if text:
            confidence = 0.0
            details = data.get("result") or []
            if details:
                confidence = sum(item.get("conf", 0.0) for item in details) / len(details)

            return {
                "source": "vosk",
                "isFinal": True,
                "interim": "",
                "final": text,
                "confidence": round(confidence, 3),
            }

        return None
