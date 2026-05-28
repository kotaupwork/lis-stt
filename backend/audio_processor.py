from __future__ import annotations

from collections import defaultdict


class AudioProcessor:
    """Session-based PCM buffer processor.

    Expects 16-bit mono PCM at 16 kHz. For quality-first operation,
    it emits 500 ms chunks (16_000 bytes per chunk).
    """

    def __init__(self, sample_rate: int = 16_000, chunk_ms: int = 500, sample_width: int = 2) -> None:
        self.sample_rate = sample_rate
        self.chunk_ms = chunk_ms
        self.sample_width = sample_width
        self.chunk_size_bytes = int(sample_rate * (chunk_ms / 1000) * sample_width)
        self._buffers: dict[str, bytearray] = defaultdict(bytearray)

    def append(self, session_id: str, pcm_bytes: bytes) -> list[bytes]:
        if not pcm_bytes:
            return []

        buf = self._buffers[session_id]
        buf.extend(pcm_bytes)

        ready: list[bytes] = []
        while len(buf) >= self.chunk_size_bytes:
            ready.append(bytes(buf[: self.chunk_size_bytes]))
            del buf[: self.chunk_size_bytes]

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
