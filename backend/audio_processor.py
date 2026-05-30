from __future__ import annotations

from collections import defaultdict


class AudioProcessor:
    """Session-based PCM buffer processor.

    Expects 16-bit mono PCM at 16 kHz. For quality-first operation,
    it emits 500 ms chunks (16_000 bytes per chunk).
    """

    def __init__(self, sample_rate: int = 16_000, chunk_ms: int = 500, sample_width: int = 2) -> None:
        self.sample_rate = sample_rate
        self.default_chunk_ms = chunk_ms
        self.sample_width = sample_width
        self.default_chunk_size_bytes = int(sample_rate * (chunk_ms / 1000) * sample_width)
        self._buffers: dict[str, bytearray] = defaultdict(bytearray)
        self._chunk_size_bytes: dict[str, int] = {}

    def append(self, session_id: str, pcm_bytes: bytes, chunk_ms: int | None = None) -> list[bytes]:
        if not pcm_bytes:
            return []

        if chunk_ms is not None:
            self._chunk_size_bytes[session_id] = int(
                self.sample_rate * (chunk_ms / 1000) * self.sample_width
            )

        chunk_size_bytes = self._chunk_size_bytes.get(session_id, self.default_chunk_size_bytes)

        buf = self._buffers[session_id]
        buf.extend(pcm_bytes)

        ready: list[bytes] = []
        while len(buf) >= chunk_size_bytes:
            ready.append(bytes(buf[:chunk_size_bytes]))
            del buf[:chunk_size_bytes]

        return ready

    def flush(self, session_id: str) -> bytes:
        buf = self._buffers.get(session_id)
        if not buf:
            return b""

        remaining = bytes(buf)
        self._buffers[session_id].clear()
        return remaining

    def reset(self, session_id: str) -> None:
        if session_id in self._buffers:
            self._buffers[session_id].clear()
        self._chunk_size_bytes.pop(session_id, None)
