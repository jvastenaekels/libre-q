"""Integration tests for PATCH /api/admin/users/{id} and verb endpoints.

Error-body note: the error middleware (``app/middleware/errors.py``) wraps a
string ``HTTPException.detail`` into the StandardError envelope
``{"code", "message", "details"}`` — so the human-readable message lives at
``resp.json()["message"]``, NOT ``["detail"]``. This mirrors the proven
pattern in ``test_inactive_user_lockout.py``.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


@pytest.mark.asyncio
async def test_patch_user_promotes_when_2fa_enabled(
    client: AsyncClient,
    superuser: User,
    superuser_token: str,
    totp_user: User,  # is_totp_enabled=True
    db: AsyncSession,
) -> None:
    resp = await client.patch(
        f"/api/admin/users/{totp_user.id}",
        json={"is_superuser": True},
        headers={"Authorization": f"Bearer {superuser_token}"},
    )
    assert resp.status_code == 200
    await db.refresh(totp_user)
    assert totp_user.is_superuser is True


@pytest.mark.asyncio
async def test_patch_user_refuses_promotion_without_2fa(
    client: AsyncClient,
    superuser: User,
    superuser_token: str,
    regular_user: User,  # is_totp_enabled=False
) -> None:
    resp = await client.patch(
        f"/api/admin/users/{regular_user.id}",
        json={"is_superuser": True},
        headers={"Authorization": f"Bearer {superuser_token}"},
    )
    assert resp.status_code == 400
    assert "2FA" in resp.json()["message"]


@pytest.mark.asyncio
async def test_patch_user_refuses_self_demote(
    client: AsyncClient,
    superuser: User,
    superuser_token: str,
) -> None:
    resp = await client.patch(
        f"/api/admin/users/{superuser.id}",
        json={"is_superuser": False},
        headers={"Authorization": f"Bearer {superuser_token}"},
    )
    assert resp.status_code == 400
    assert "yourself" in resp.json()["message"]


@pytest.mark.asyncio
async def test_patch_user_deactivate_immediately_locks_token(
    client: AsyncClient,
    superuser_token: str,
    regular_user: User,
    regular_user_token: str,
) -> None:
    pre = await client.get(
        "/api/me", headers={"Authorization": f"Bearer {regular_user_token}"}
    )
    assert pre.status_code == 200

    resp = await client.patch(
        f"/api/admin/users/{regular_user.id}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {superuser_token}"},
    )
    assert resp.status_code == 200

    post = await client.get(
        "/api/me", headers={"Authorization": f"Bearer {regular_user_token}"}
    )
    assert post.status_code == 401


@pytest.mark.asyncio
async def test_patch_user_404_when_target_missing(
    client: AsyncClient, superuser_token: str
) -> None:
    resp = await client.patch(
        "/api/admin/users/999999",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {superuser_token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_patch_user_403_when_caller_not_superuser(
    client: AsyncClient,
    regular_user_token: str,
    regular_user: User,
) -> None:
    resp = await client.patch(
        f"/api/admin/users/{regular_user.id}",
        json={"full_name": "Hax"},
        headers={"Authorization": f"Bearer {regular_user_token}"},
    )
    assert resp.status_code == 403
