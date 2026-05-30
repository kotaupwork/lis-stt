from fastapi.testclient import TestClient

from backend.app import app


client = TestClient(app)


def test_health_route() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert "vosk_ws_url" in data


def test_transcribe_empty_payload_returns_ok() -> None:
    response = client.post(
        "/api/transcribe",
        files={"audio": ("empty.pcm", b"", "application/octet-stream")},
        data={"session_id": "test-session"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["bufferedBytes"] == 0
