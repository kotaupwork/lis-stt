from __future__ import annotations

import asyncio
import json
import uuid
from collections import defaultdict

from fastapi import WebSocket


class SessionManager:
    def __init__(self) -> None:
        self._clients: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    def ensure_session(self, session_id: str | None = None) -> str:
        return session_id or str(uuid.uuid4())

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._clients[session_id].add(websocket)

    async def disconnect(self, session_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            if session_id not in self._clients:
                return
            self._clients[session_id].discard(websocket)
            if not self._clients[session_id]:
                del self._clients[session_id]

    async def publish(self, session_id: str, payload: dict) -> None:
        message = json.dumps(payload)

        async with self._lock:
            targets = list(self._clients.get(session_id, set()))

        stale: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_text(message)
            except Exception:
                stale.append(ws)

        if stale:
            async with self._lock:
                for ws in stale:
                    self._clients[session_id].discard(ws)
                if session_id in self._clients and not self._clients[session_id]:
                    del self._clients[session_id]
