from backend.audio_processor import AudioProcessor


def test_audio_processor_chunking() -> None:
    processor = AudioProcessor(sample_rate=16_000, chunk_ms=500)

    # 500ms at 16kHz, 16-bit mono => 16000 bytes
    payload = b"a" * 16_000
    ready = processor.append("s1", payload)

    assert len(ready) == 1
    assert len(ready[0]) == 16_000


def test_audio_processor_flush_remaining() -> None:
    processor = AudioProcessor(sample_rate=16_000, chunk_ms=500)

    processor.append("s2", b"a" * 8_000)
    leftover = processor.flush("s2")

    assert len(leftover) == 8_000
    assert processor.flush("s2") == b""
