"""Consolidated integration tests for data exports (CSV, JSON)."""

import pytest
from httpx import AsyncClient

from app.models import Study, User


@pytest.mark.asyncio
class TestExports:
    """Tests for study data exports."""

    async def test_export_json_dump_success(
        self,
        client: AsyncClient,
        test_user: User,
        seed_study: Study,
        auth_token_factory,
    ):
        headers = auth_token_factory(test_user)
        # Note: endpoint is /dump for the JSON full data
        response = await client.get(
            f"/api/admin/studies/{seed_study.slug}/dump", headers=headers
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"
        data = response.json()
        assert "study" in data
        assert "participants" in data

    async def test_export_csv_success(
        self,
        client: AsyncClient,
        test_user: User,
        seed_study: Study,
        auth_token_factory,
    ):
        headers = auth_token_factory(test_user)
        response = await client.get(
            f"/api/admin/studies/{seed_study.slug}/export/csv", headers=headers
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]
        assert len(response.text) > 0

    async def test_export_zip_success(
        self,
        client: AsyncClient,
        test_user: User,
        seed_study: Study,
        auth_token_factory,
    ):
        headers = auth_token_factory(test_user)
        response = await client.get(
            f"/api/admin/studies/{seed_study.slug}/export/pqmethod", headers=headers
        )
        assert response.status_code == 200
        assert "application/zip" in response.headers["content-type"]

    async def test_export_unauthorized(
        self, client: AsyncClient, user_factory, seed_study: Study, auth_token_factory
    ):
        # User who is not a collaborator
        other_user = await user_factory(email="hacker@test.com")
        headers = auth_token_factory(other_user)

        response = await client.get(
            f"/api/admin/studies/{seed_study.slug}/dump", headers=headers
        )
        # check_study_permission returns 404 for studies you can't see
        assert response.status_code == 404
