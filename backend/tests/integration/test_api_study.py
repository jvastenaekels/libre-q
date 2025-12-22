import pytest

# 1. Get Study Config
@pytest.mark.asyncio
async def test_get_study_config(client, seed_study):
    response = await client.get(f"/api/study/{seed_study.slug}")
    assert response.status_code == 200
    data = response.json()
    assert data["slug"] == seed_study.slug
    assert data["title"] == "Test Study"
    assert len(data["statements"]) == 4
    # Check default lang is en
    assert data["consent"]["title"] == "Consent"

@pytest.mark.asyncio
async def test_get_study_not_found(client, db):
    response = await client.get("/api/study/non-existent-slug")
    assert response.status_code == 404
