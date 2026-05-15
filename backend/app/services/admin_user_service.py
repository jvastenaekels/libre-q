# Qualis - Open-source platform for conducting Q-methodology research
# Copyright (C) 2026 Julien Vastenaekels
# Licensed under the GNU Affero General Public License v3.0 or later.

"""Admin user management service.

Centralises the three guard rails that protect operator self-service from
foot-guns:

1. **Anti-self-demote / anti-self-deactivate.** A superuser cannot remove
   their own elevated status or active flag in one click — they must ask
   another superuser to do it, which forces an explicit hand-off.

2. **At-least-one-active-superuser.** Refuse any change that would leave
   ``count(is_superuser AND is_active) == 0``. This is the lockout-proof
   rule: as long as the count stays >= 1, the platform always has someone
   who can recover access.

3. **2FA-required-for-superuser-promotion.** A user without TOTP enabled
   cannot be promoted. The bar to operate Qualis as superuser is a
   working second factor; without it, the promotion is refused so the
   operator fixes the prerequisite first.

The verb actions (force_password_reset, reset_totp) live here too so the
router stays a thin HTTP layer.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import User
from app.utils.email import send_password_reset
from app.utils.security import create_email_token, get_password_hash


class AdminUserError(Exception):
    """Raised when an admin user action violates a guard rail.

    The router translates this to HTTP 400/409. The message is operator-
    facing English (no secrets, no enumeration risk — the caller is
    already a superuser).
    """


async def _count_active_superusers(db: AsyncSession) -> int:
    stmt = (
        select(func.count())
        .select_from(User)
        .where(User.is_superuser.is_(True))
        .where(User.is_active.is_(True))
    )
    return int((await db.execute(stmt)).scalar_one())


async def assert_can_demote_superuser(
    *, db: AsyncSession, actor: User, target: User
) -> None:
    if actor.id == target.id:
        raise AdminUserError("You cannot demote yourself.")
    if not target.is_superuser:
        return  # idempotent: demoting a non-superuser is a no-op
    if not target.is_active:
        return  # already inactive, doesn't count toward the floor
    remaining = await _count_active_superusers(db)
    if remaining <= 1:
        raise AdminUserError(
            "Refusing: the platform must keep at least one active superuser."
        )


async def assert_can_deactivate(*, db: AsyncSession, actor: User, target: User) -> None:
    if actor.id == target.id:
        raise AdminUserError("You cannot deactivate yourself.")
    if not target.is_active:
        return  # idempotent
    if not target.is_superuser:
        return
    remaining = await _count_active_superusers(db)
    if remaining <= 1:
        raise AdminUserError(
            "Refusing: the platform must keep at least one active superuser."
        )


async def assert_can_promote_superuser(
    *, db: AsyncSession, actor: User, target: User
) -> None:
    del db  # unused; signature kept symmetric for the router
    del actor
    if target.is_superuser:
        return  # idempotent
    if not target.is_totp_enabled:
        raise AdminUserError(
            "Refusing: target must have 2FA enabled before being promoted "
            "to superuser. Ask them to set up TOTP first, then retry."
        )


async def force_password_reset(*, db: AsyncSession, target: User) -> None:
    """Rotate the target's password to an unguessable value, bump
    ``password_changed_at`` (kills every existing access token via
    F-03-010), and send the standard password-reset email.

    The user is fully locked out until they click the email link and pick
    a new password. The endpoint is the operator's "this account is
    compromised, force-rotate now" button.
    """
    throwaway = secrets.token_urlsafe(32)
    target.hashed_password = get_password_hash(throwaway)
    target.password_changed_at = datetime.now(timezone.utc)
    token = create_email_token(
        email=target.email,
        purpose="password_reset",
        expires_delta=timedelta(hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS),
        password_changed_at=target.password_changed_at,
    )
    url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    await db.commit()
    send_password_reset(target.email, url)


async def reset_totp(*, db: AsyncSession, target: User) -> None:
    """Clear all TOTP state on the target account.

    Use case: the user has lost their authenticator and the operator
    verifies their identity out of band. Next login, the target will be
    able to set up 2FA again from /me. No email is sent in v1.
    """
    target.totp_secret = None
    target.is_totp_enabled = False
    target.totp_channel = None
    await db.commit()
