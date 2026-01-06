"""Consolidated integration tests for recruitment links and collaborator invitations."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, StudyRole


@pytest.mark.asyncio
class TestRecruitment:
    """Tests for recruitment link management and statistics."""

    async def test_recruitment_logic(
        self,
        client: AsyncClient,
        db: AsyncSession,
        test_user: User,
        auth_token_factory,
        study_factory,
        workspace_factory,
        study_collaborator_factory,
    ):
        # 1. Setup
        ws = await workspace_factory(owner=test_user)
        study = await study_factory(workspace=ws, owner=test_user)
        await study_collaborator_factory(study, test_user, StudyRole.owner)
        headers = auth_token_factory(test_user)

        # 2. Create Links
        response = await client.post(
            f"/api/admin/recruitment/{study.slug}/links?count=2",
            json={"type": "public", "name": "Social Media"},
            headers=headers,
        )
        assert response.status_code == 200
        links = response.json()
        assert len(links) == 2
        token = links[0]["token"]

        # 3. Access Study via Link (Increments start_count)
        response = await client.get(f"/api/study/{study.slug}?link_token={token}")
        assert response.status_code == 200

        # Verify stats
        response = await client.get(
            f"/api/admin/recruitment/{study.slug}/links", headers=headers
        )
        data = response.json()
        target_link = next(link for link in data if link["token"] == token)
        assert target_link["start_count"] == 1


@pytest.mark.asyncio
class TestInvitations:
    """Tests for collaborator invitation flow."""

    async def test_invitation_flow(
        self,
        client: AsyncClient,
        db: AsyncSession,
        test_user: User,
        auth_token_factory,
        study_factory,
        workspace_factory,
        study_collaborator_factory,
    ):
        ws = await workspace_factory(owner=test_user)
        study = await study_factory(workspace=ws, owner=test_user)
        await study_collaborator_factory(study, test_user, StudyRole.owner)
        headers = auth_token_factory(test_user)

        # 1. Invite
        response = await client.post(
            f"/api/admin/invitations/{study.slug}/invite",
            json={"email": "collab@test.com", "role": "editor"},
            headers=headers,
        )
        assert response.status_code == 200
        token = response.json()["token"]

        # 2. Verify Token
        response = await client.get(f"/api/admin/invitations/verify?token={token}")
        assert response.status_code == 200
        assert response.json()["email"] == "collab@test.com"
