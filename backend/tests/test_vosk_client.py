from backend.vosk_client import VoskClient


def test_normalize_partial_result() -> None:
    payload = {"partial": "hello wor"}
    normalized = VoskClient._normalize_result(payload)

    assert normalized is not None
    assert normalized["isFinal"] is False
    assert normalized["interim"] == "hello wor"
    assert normalized["source"] == "vosk"


def test_normalize_final_result_with_confidence() -> None:
    payload = {
        "text": "hello world",
        "result": [
            {"conf": 0.9, "word": "hello"},
            {"conf": 0.8, "word": "world"},
        ],
    }
    normalized = VoskClient._normalize_result(payload)

    assert normalized is not None
    assert normalized["isFinal"] is True
    assert normalized["final"] == "hello world"
    assert normalized["confidence"] == 0.85


def test_normalize_empty_result_returns_none() -> None:
    assert VoskClient._normalize_result({}) is None
