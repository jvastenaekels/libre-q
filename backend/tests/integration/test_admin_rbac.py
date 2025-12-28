"""Integration tests for study collaborator management and RBAC."""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Study, StudyCollaborator, StudyRole, StudyState, User
from app.utils.security import create_access_token, get_password_hash


@pytest_asyncio.fixture
async def users(db: AsyncSession):
    """Creates multiple users for testing."""
    u1 = User(
        email="u1@test.com", hashed_password=get_password_hash("pass"), is_active=True
    )
    u2 = User(
        email="u2@test.com", hashed_password=get_password_hash("pass"), is_active=True
    )
    u3 = User(
        email="u3@test.com", hashed_password=get_password_hash("pass"), is_active=True
    )
    db.add_all([u1, u2, u3])
    await db.commit()
    return [u1, u2, u3]


@pytest_asyncio.fixture
async def study(db: AsyncSession, users):
    """Creates a study owned by u1."""
    u1 = users[0]
    s = Study(
        slug="test-rbac",
        owner_id=u1.id,
        state=StudyState.draft,
        grid_config=[],
        presort_config={},
        postsort_config={},
    )
    db.add(s)
    await db.flush()

    collab = StudyCollaborator(study_id=s.id, user_id=u1.id, role=StudyRole.owner)
    db.add(collab)
    await db.commit()
    return s


@pytest.mark.asyncio
async def test_owner_can_add_collaborator(
    client: AsyncClient, users, study: Study, db: AsyncSession
):
    """Test that owner (u1) can add u2 as editor."""
    u1 = users[0]
    token = create_access_token(subject=u1.email)
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"email": "u2@test.com", "role": "editor"}
    response = await client.post(
        f"/api/admin/studies/{study.slug}/collaborators", json=payload, headers=headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["user_email"] == "u2@test.com"
    assert data["role"] == "editor"


@pytest.mark.asyncio
async def test_editor_cannot_add_collaborator(
    client: AsyncClient, users, study: Study, db: AsyncSession
):
    """Test that editor (u2) cannot add u3."""
    # 1. Add u2 as editor
    u1, u2, u3 = users
    db.add(StudyCollaborator(study_id=study.id, user_id=u2.id, role=StudyRole.editor))
    await db.commit()

    # 2. Try to add u3 as u2
    token = create_access_token(subject=u2.email)
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"email": "u3@test.com", "role": "viewer"}
    response = await client.post(
        f"/api/admin/studies/{study.slug}/collaborators", json=payload, headers=headers
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_collaborators(
    client: AsyncClient, users, study: Study, db: AsyncSession
):
    """Test listing collaborators."""
    u1, u2, u3 = users
    db.add(StudyCollaborator(study_id=study.id, user_id=u2.id, role=StudyRole.editor))
    await db.commit()

    token = create_access_token(subject=u1.email)
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.get(
        f"/api/admin/studies/{study.slug}/collaborators", headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    emails = [c["user_email"] for c in data]
    assert "u1@test.com" in emails
    assert "u2@test.com" in emails


@pytest.mark.asyncio
async def test_remove_collaborator(
    client: AsyncClient, users, study: Study, db: AsyncSession
):
    """Test removing a collaborator."""
    u1, u2, _ = users
    db.add(StudyCollaborator(study_id=study.id, user_id=u2.id, role=StudyRole.editor))
    await db.commit()

    token = create_access_token(subject=u1.email)
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.delete(
        f"/api/admin/studies/{study.slug}/collaborators/u2@test.com", headers=headers
    )
    assert response.status_code == 204

    # Verify
    res = await db.execute(
        select(StudyCollaborator).where(
            StudyCollaborator.study_id == study.id, StudyCollaborator.user_id == u2.id
        )
    )
    assert res.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_cannot_remove_owner(
    client: AsyncClient, users, study: Study, db: AsyncSession
):
    """Test that owner cannot be removed."""
    u1 = users[0]
    token = create_access_token(subject=u1.email)
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.delete(
        f"/api/admin/studies/{study.slug}/collaborators/u1@test.com", headers=headers
    )
    assert response.status_code == 400
    assert "Cannot remove the study owner" in response.json()["detail"]
