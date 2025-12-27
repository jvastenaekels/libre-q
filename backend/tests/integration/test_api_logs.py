"""Integration tests for the Logs API."""

import pytest


@pytest.mark.asyncio
async def test_report_log_success(client):
    payload = {
        "level": "error",
        "message": "Test error message",
        "stack": "Error: test\n    at Object.<anonymous> (test.js:1:1)",
        "url": "http://localhost:5173/test",
        "userAgent": "Mozilla/5.0",
        "context": {"component": "TestComponent"},
    }
    response = await client.post("/api/logs", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "received"


@pytest.mark.asyncio
async def test_report_log_minimal(client):
    payload = {"level": "info", "message": "Minimal log"}
    response = await client.post("/api/logs", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "received"


@pytest.mark.asyncio
async def test_report_log_reserved_key_collision(client):
    """Regression test for the KeyError: "Attempt to overwrite 'message' in LogRecord".

    This happens when the payload contains a key named 'message' which conflicts
    with the internal attributes of LogRecord.
    """
    payload = {
        "level": "error",
        "message": "This should not cause a KeyError",
        "other_field": "test",
    }
    # If the fix isn't working, this will return a 500 error
    response = await client.post("/api/logs", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "received"


@pytest.mark.asyncio
async def test_report_log_invalid_level(client):
    payload = {"level": "invalid", "message": "Invalid level test"}
    response = await client.post("/api/logs", json=payload)
    assert response.status_code == 422  # Pydantic validation error
