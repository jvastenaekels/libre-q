# Qualis - Open-source platform for conducting Q-methodology research
# Copyright (C) 2025 Julien Vastenekels
# Licensed under the GNU Affero General Public License v3.0 or later.

"""Email-OTP service for the 2FA email channel.

A single user has at most one active (non-used, non-expired) code at any
time. Each `issue_otp` call invalidates previous active codes for the
same user and enforces a 30-second resend cooldown.

Brute-force defence (F-03-004): wrong-attempt counter per row caps a
single code at 5 guesses, but an attacker can rotate fresh codes every
30s. To prevent ~14k guesses/day per account, ``verify_otp`` also
enforces a per-account 24h ceiling of wrong attempts (sum of
``attempts`` across all rows in the last 24h), configured via
``settings.TWOFA_OTP_WRONG_ATTEMPT_CAP_24H`` (default 30). Once the
ceiling is hit, ``verify_otp`` raises ``OTPLockoutError`` until older
rows age out of the window.
"""

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import TwoFAEmailOTPCode, User
from app.utils.security import get_password_hash, verify_password


class OTPRateLimitError(Exception):
    """Raised when issue_otp is called within the resend cooldown window."""


class OTPLockoutError(Exception):
    """Raised when ``verify_otp`` is called after the per-account 24h
    wrong-attempt cap (``settings.TWOFA_OTP_WRONG_ATTEMPT_CAP_24H``) is
    reached.

    This is independent from the per-row ``attempts >= 5`` cap: the
    per-row cap kills one code, the 24h cap kills further verification
    attempts on the account regardless of how many fresh codes have
    been issued.
    """


async def _get_active_code(db: AsyncSession, user: User) -> TwoFAEmailOTPCode | None:
    result = await db.execute(
        select(TwoFAEmailOTPCode)
        .where(
            TwoFAEmailOTPCode.user_id == user.id,
            TwoFAEmailOTPCode.used_at.is_(None),
        )
        .order_by(TwoFAEmailOTPCode.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def issue_otp(db: AsyncSession, user: User) -> str:
    """Generate a fresh 6-digit code, return plaintext for emailing."""
    now = datetime.now(tz=timezone.utc)

    last = await _get_active_code(db, user)
    if last is not None:
        cooldown = timedelta(seconds=settings.TWOFA_EMAIL_OTP_RESEND_COOLDOWN_SECONDS)
        if last.created_at > now - cooldown:
            raise OTPRateLimitError(
                f"OTP resend cooldown active "
                f"(retry after {settings.TWOFA_EMAIL_OTP_RESEND_COOLDOWN_SECONDS}s)"
            )

    await invalidate_active_otps(db, user)

    plaintext = f"{secrets.randbelow(1_000_000):06d}"
    code = TwoFAEmailOTPCode(
        user_id=user.id,
        code_hash=get_password_hash(plaintext),
        expires_at=now + timedelta(minutes=settings.TWOFA_EMAIL_OTP_EXPIRE_MINUTES),
    )
    db.add(code)
    await db.flush()
    return plaintext


async def _count_wrong_attempts_24h(db: AsyncSession, user: User) -> int:
    """Sum ``attempts`` across this user's OTP rows in the last 24h.

    Each row's ``attempts`` is the per-row wrong-guess counter (capped at
    5). Summing over rows in the rolling 24h window gives total wrong
    attempts on the account regardless of how many codes were issued.
    Rows older than 24h naturally age out of the cap.
    """
    cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=24)
    result = await db.execute(
        select(func.coalesce(func.sum(TwoFAEmailOTPCode.attempts), 0)).where(
            TwoFAEmailOTPCode.user_id == user.id,
            TwoFAEmailOTPCode.created_at > cutoff,
        )
    )
    total = result.scalar_one()
    return int(total or 0)


async def verify_otp(db: AsyncSession, user: User, code: str) -> bool:
    """Verify a candidate code. Marks used_at on success, increments attempts on failure.

    Raises ``OTPLockoutError`` if the per-account 24h wrong-attempt cap
    (``settings.TWOFA_OTP_WRONG_ATTEMPT_CAP_24H``) has already been
    reached. The cap is checked **before** this call's attempt is
    counted — so the Nth-and-final wrong attempt still returns False
    (incrementing the counter to N), and the (N+1)th call raises. This
    keeps the failure response identical for legitimate users who
    happen to mistype on their last allowed attempt; only sustained
    attack triggers the raise.
    """
    now = datetime.now(tz=timezone.utc)

    # Per-account 24h ceiling — checked before the per-row gate so an
    # attacker cannot reset the counter by spinning a fresh row.
    cap = settings.TWOFA_OTP_WRONG_ATTEMPT_CAP_24H
    wrong_in_window = await _count_wrong_attempts_24h(db, user)
    if wrong_in_window >= cap:
        raise OTPLockoutError(
            f"OTP verification locked: {wrong_in_window} wrong attempts in "
            f"the last 24h (cap {cap}). Try again later."
        )

    row = await _get_active_code(db, user)
    if row is None or row.expires_at <= now or row.attempts >= 5:
        return False
    if not verify_password(code, row.code_hash):
        row.attempts += 1
        return False
    row.used_at = now
    return True


async def invalidate_active_otps(db: AsyncSession, user: User) -> None:
    """Mark all active (non-used) OTP codes for the user as used."""
    now = datetime.now(tz=timezone.utc)
    await db.execute(
        update(TwoFAEmailOTPCode)
        .where(
            TwoFAEmailOTPCode.user_id == user.id,
            TwoFAEmailOTPCode.used_at.is_(None),
        )
        .values(used_at=now)
    )
