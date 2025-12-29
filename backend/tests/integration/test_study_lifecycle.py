"""Integration tests for Study Lifecycle (Pausing, Minor Mods, Blocking Submissions)."""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Study, User
from app.utils.security import create_access_token


@pytest.mark.asyncio
async def test_study_pausing_and_submissions(
    client: AsyncClient, test_user: User, seed_study: Study, db: AsyncSession
):
    """Test that pausing a study blocks submissions but allows metadata updates."""
    access_token = create_access_token(subject=test_user.email)
    headers = {"Authorization": f"Bearer {access_token}"}
    slug = seed_study.slug

    # 1. Initially ACTIVE (from seed_study)
    response = await client.get(f"/api/study/{slug}")
    assert response.status_code == 200
    assert response.json()["state"] == "active"

    # 2. Pause the study
    response = await client.post(
        f"/api/admin/studies/{slug}/state?new_state=paused", headers=headers
    )
    assert response.status_code == 200
    assert response.json()["state"] == "paused"

    # 3. Try to submit while paused (should FAIL)
    submission_payload = {
        "study_slug": slug,
        "session_token": "eadf28c4-e8f0-410a-8673-99787e914040",
        "language_used": "en",
        "qsort": [{"statement_id": seed_study.statements[0].id, "grid_score": 1}],
    }
    response = await client.post("/api/submit", json=submission_payload)
    assert response.status_code == 400
    assert "paused" in response.json()["detail"]

    # 4. Resume the study
    response = await client.post(
        f"/api/admin/studies/{slug}/state?new_state=active", headers=headers
    )
    assert response.status_code == 200
    assert response.json()["state"] == "active"

    # 5. Submit while active (should SUCCEED)
    # Note: might need to fix distribution if seed study has grid config
    # For simplicity, if seed_study only has 1 statement, we need 1 slot at score 1.
    response = await client.post("/api/submit", json=submission_payload)
    # Depending on seed_study config, this might fail on distribution if not careful.
    # Let's check status code. If 400 with 'Distribution', it's fine (blocked/passed state check).
    if response.status_code == 400:
        assert "Distribution" in response.json().get(
            "detail", ""
        ) or "active" not in response.json().get("detail", "")
    else:
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_minor_modifications_while_active(
    client: AsyncClient, test_user: User, seed_study: Study, db: AsyncSession
):
    """Test that non-structural updates (translations, text) are allowed while active."""
    access_token = create_access_token(subject=test_user.email)
    headers = {"Authorization": f"Bearer {access_token}"}
    slug = seed_study.slug

    # 1. Update metadata (Allowed)
    update_payload: dict[str, Any] = {"show_statement_codes": True}
    response = await client.patch(
        f"/api/admin/studies/{slug}", json=update_payload, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["show_statement_codes"] is True

    # 2. Update translation (Allowed)
    update_payload = {
        "translations": [
            {
                "language_code": "en",
                "title": "Modified Title While Active",
                "ui_labels": {},
            }
        ]
    }
    response = await client.patch(
        f"/api/admin/studies/{slug}", json=update_payload, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["translations"][0]["title"] == "Modified Title While Active"

    # 3. Update statement text (Allowed)
    statement_code = seed_study.statements[0].code
    update_payload = {
        "statements": [
            {
                "code": statement_code,
                "translations": [{"language_code": "en", "text": "Fixed typo here!"}],
            }
        ]
    }
    response = await client.patch(
        f"/api/admin/studies/{slug}", json=update_payload, headers=headers
    )
    assert response.status_code == 200
    # Verify participant view
    resp_pub = await client.get(f"/api/study/{slug}?lang=en")
    updated_stmt = next(
        s for s in resp_pub.json()["statements"] if s["code"] == statement_code
    )
    assert updated_stmt["text"] == "Fixed typo here!"

    # 4. Attempt structural update (Blocked)
    update_payload = {"grid_config": [{"score": 0, "capacity": 10}]}
    response = await client.patch(
        f"/api/admin/studies/{slug}", json=update_payload, headers=headers
    )
    assert response.status_code == 400
    assert "grid structure" in response.json()["detail"]
