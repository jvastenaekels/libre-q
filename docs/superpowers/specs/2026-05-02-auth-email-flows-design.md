# Auth email flows — design

**Date** : 2026-05-02
**Status** : approved (brainstorming), pending implementation plan
**Scope** : add email-driven auth flows on top of existing TOTP 2FA + open registration

## Problem

Qualis currently has:
- **2FA TOTP-only** via `pyotp` (QR enrollment). No email-based 2FA channel, no recovery if the authenticator is lost.
- **Open registration** : `/auth/register` creates accounts with `is_active=True` immediately. No email-of-record proof.
- **No password reset** flow. A locked-out user must contact an admin manually.

The existing SMTP transport (`app/utils/email.py`) already sends invitation and memo-mention emails, with a clean dev-mode fallback (logs the email instead of sending when `SMTP_HOST` is missing). The transport is solid; what's missing is the auth-side flows on top of it.

This spec adds four flows:

| Flow | Format | Action |
|---|---|---|
| Email verification at registration | signed link | activate the account |
| Password reset | signed link | open new-password form |
| 2FA disable (recovery) | signed link | force `is_totp_enabled=False` |
| 2FA login via email-OTP | 6-digit code | submitted as `x-totp-token` header |

Registration via a valid `invitation_token` skips email verification (the token already proves email ownership).

## Approach

**Hybrid tokens — JWT for the link-based flows, a small DB table for the OTP login codes.**

- The three link-based flows (verify, reset, 2FA-disable) use signed JWT tokens with a `purpose` claim and short expiries. This mirrors the existing `decode_invitation_token` pattern in `app/utils/security.py`. No new table required.
- The 2FA email-OTP login uses a 6-digit numeric code stored hashed in a new `twofa_email_otp_codes` table. Three properties make a JWT-in-URL inadequate here: the user must be able to type the code into the existing 2FA form (not click a link, which would defeat the purpose if email is the second factor); brute-force resistance requires server-side attempt counting; consume-once semantics require a server-side `used_at` marker.

A pure stateless approach (JWT for everything) was rejected — see "Approaches considered" at the end.

A pure stateful approach (one `email_tokens` table covering all four flows) was rejected as over-engineering for current needs. Could be revisited if/when admin tooling needs to inspect outstanding tokens.

## Data model

### `users` — two columns added

| Column | Type | Notes |
|---|---|---|
| `email_verified_at` | `datetime \| None` | `NULL` = unverified. Date (not bool) so audit can see when verification happened. |
| `totp_channel` | `str \| None` (`'app' \| 'email'`) | active channel when `is_totp_enabled=True`; `NULL` otherwise. |

### `twofa_email_otp_codes` — new table

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `user_id` | FK `users.id` ON DELETE CASCADE | indexed |
| `code_hash` | str | bcrypt of the 6-digit code, never plaintext |
| `expires_at` | datetime | typically `created_at + 5 min` |
| `attempts` | int default 0 | incremented on each wrong submission |
| `used_at` | datetime nullable | consume-once marker |
| `created_at` | datetime default `NOW()` | for resend rate-limit |

Index : partial `(user_id) WHERE used_at IS NULL` to find the active code quickly.

### Migration

Single Alembic migration `add_email_verification_and_2fa_email_otp`, added after head `62538cba702e`.

**Backfill required** (avoids breaking existing accounts):
- `users.email_verified_at = NOW()` for all existing rows
- `users.totp_channel = 'app'` for rows where `is_totp_enabled = True`

## Service layer

### `app/utils/security.py` — additions

Module is under `mypy --strict`, payload uses `TypedDict`:

```python
EmailTokenPurpose = Literal["email_verify", "password_reset", "twofa_disable"]

class EmailTokenPayload(TypedDict, total=False):
    sub: Required[str]                # user email
    purpose: Required[EmailTokenPurpose]
    exp: Required[int]
    iat: Required[int]
    jti: Required[str]                # unique ID for audit/log
    pwh_prefix: str                   # password-reset only: first 8 chars of current hashed_password (replay defense)

def create_email_token(email: str, purpose: EmailTokenPurpose,
                       expires_delta: timedelta,
                       pwh_prefix: str | None = None) -> str: ...
def decode_email_token(token: str, expected_purpose: EmailTokenPurpose) -> EmailTokenPayload: ...
```

Signed with the same `SECRET_KEY` as other JWT tokens.

### `app/services/email_otp_service.py` — new (under `mypy --strict`)

```python
class OTPRateLimitError(Exception): pass

async def issue_otp(db: AsyncSession, user: User) -> str  # returns plaintext code for email
async def verify_otp(db: AsyncSession, user: User, code: str) -> bool
async def invalidate_active_otps(db: AsyncSession, user: User) -> None
```

Internal rules:
- `issue_otp` generates 6 digits via `secrets.randbelow(1_000_000)` formatted `06d`, bcrypt-hashes, writes to DB with `expires_at = now + TWOFA_EMAIL_OTP_EXPIRE_MINUTES`. **Invalidates active codes for the same user first** (one valid code at a time).
- Rate-limit "1 OTP per 30 s per user": if last `created_at` < 30 s, raises `OTPRateLimitError` → router maps to HTTP 429.
- `verify_otp` finds the active non-used non-expired code, checks `attempts < 5`, compares bcrypt, marks `used_at` on success, increments `attempts` on failure. At the 5th failure the code is dead.

### `app/utils/email.py` — four new functions

Same shape as `send_invitation_email` (inline HTML, dev-mode logging fallback when SMTP unset):

- `send_email_verification(email_to, verify_url)`
- `send_password_reset(email_to, reset_url)`
- `send_twofa_disable_link(email_to, disable_url)`
- `send_twofa_login_otp(email_to, code)`

No Jinja templates yet — four inline templates remain readable. To revisit beyond ~8 templates.

No `EmailVerificationService` class — each flow is `encode → email` and `decode → find user → apply action`. The route handlers compose the helpers directly.

## Endpoints

### Modified

**`POST /auth/register`** :
- If valid `invitation_token` matching the supplied email → `email_verified_at = NOW()`, `is_active = True` (current behavior preserved).
- Otherwise → `is_active = False`, `email_verified_at = NULL`, send verification email.
- Response body becomes `{user, requires_email_verification: bool}` instead of bare `User`.

**`POST /auth/token`** :
- If `EMAIL_VERIFICATION_REQUIRED=True` and `email_verified_at IS NULL` → HTTP 403 `email_not_verified` (frontend shows resend). When `EMAIL_VERIFICATION_REQUIRED=False`, the check is skipped (kill switch for environments without SMTP).
- 2FA branch keys on `user.totp_channel`:
  - `'app'` → unchanged (header `x-totp-token` checked against TOTP secret).
  - `'email'` → without header, calls `issue_otp` + sends email + returns `Token(requires_2fa=True, channel='email')`. With header, calls `verify_otp`.
- `Token` schema gains optional `channel: Literal['app', 'email'] | None`.

**`POST /auth/2fa/enable`** :
- Body gains `channel: 'app' | 'email'`.
- `'app'` → current TOTP flow + `totp_channel = 'app'`.
- `'email'` → no QR code; one dry-run `issue_otp` + user submits the code to confirm channel works → `is_totp_enabled = True`, `totp_secret = NULL`, `totp_channel = 'email'`.

### New

| Endpoint | Auth | Rate-limit | Body | Effect |
|---|---|---|---|---|
| `POST /auth/email/verify` | none | n/a | `{token}` | activate account (idempotent) |
| `POST /auth/email/verify/resend` | none | 3/h | `{email}` | resend verification (always 200) |
| `POST /auth/password/reset/request` | none | 3/h | `{email}` | send reset link (always 200) |
| `POST /auth/password/reset/confirm` | none | n/a | `{token, new_password}` | rotate password + `invalidate_active_otps` |
| `POST /auth/2fa/disable/request` | none | 3/h | `{email}` | send 2FA-disable link (always 200) |
| `POST /auth/2fa/disable/confirm` | none | n/a | `{token}` | clear `is_totp_enabled / totp_secret / totp_channel` |

Anti-enumeration : every "request" endpoint returns 200 regardless of whether the email exists or whether the user is in the right state.

### Audit

Each sensitive mutation calls `app.utils.audit.log_admin_action(...)` (free-form `action` / `resource` strings, no closed enum to extend). New `(action, resource)` pairs: `('email_verify', 'user')`, `('password_reset_confirm', 'user')`, `('twofa_disable_confirm', 'user')`, `('twofa_enable', 'user')`, `('twofa_login_failed', 'user')`. The `details` dict carries `{'channel': 'email'|'app'}` where relevant. Tokens and codes never appear in details (per the audit util's docstring contract).

## Frontend

### New pages (`frontend/src/pages/`)

- `EmailVerificationSentPage.tsx` — post-registration screen: "verify your email at {x}", "resend" button with cooldown.
- `EmailVerifyPage.tsx` — landing for `/verify-email?token=…`: spinner → success or "link expired, [resend]".
- `PasswordResetRequestPage.tsx` — `/forgot-password`, single email field.
- `PasswordResetConfirmPage.tsx` — `/reset-password?token=…`, new-password + confirm fields with the same validations as signup.
- `TwoFactorRecoveryPage.tsx` — `/2fa/recover`, single email field.
- `TwoFactorDisablePage.tsx` — `/2fa/disable?token=…`, requires explicit click to confirm (no auto-disable on page load).

### Modified pages

- `RegisterPage.tsx` — on success, redirect to `EmailVerificationSentPage` (or to dashboard when invited, current behavior).
- `LoginPage.tsx` — handle the new `channel` field in `Token`. If `'email'`, show "code sent to your email" instead of "open your authenticator". Add "lost 2FA" link → `/2fa/recover` and "forgot password" link → `/forgot-password`.
- `ProfilePage.tsx` (or admin equivalent) — 2FA section: add `'app' | 'email'` channel selector at enable time.

### Hooks rule

Each new page is < 100 LOC of non-JSX logic (one API call + `loading|error|success` state). The CLAUDE.md `use<Name>` hook extraction rule does not trigger.

### API client

Regenerated via `make generate-api` after backend schemas land.

### i18n

New keys added under `auth.email.*`, `auth.password_reset.*`, `auth.twofa.recovery.*`, `auth.twofa.disable.*`, `auth.twofa.enable.{channel_app, channel_email, channel_help}`, `auth.login.{otp_email_sent, lost_2fa_link, forgot_password_link}`. All three locales (`en`, `fr`, `fi`) — `npm run i18n-check` validates parity.

## Configuration

New settings in `app/core/config.py` with safe defaults:

```python
EMAIL_VERIFICATION_REQUIRED: bool = True
EMAIL_VERIFY_TOKEN_EXPIRE_HOURS: int = 24
PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 1
TWOFA_DISABLE_TOKEN_EXPIRE_MINUTES: int = 15
TWOFA_EMAIL_OTP_EXPIRE_MINUTES: int = 5
TWOFA_EMAIL_OTP_RESEND_COOLDOWN_SECONDS: int = 30
```

Existing `FRONTEND_URL` (already present at `app/core/config.py:25`) is the base for building action links.

`SMTP_HOST/USER/PASSWORD/PORT/TLS/EMAILS_FROM_*` already exist — unchanged.

## Dev / production behavior

**SMTP unset (dev)** : strict alignment with the existing `send_invitation_email` pattern — log a warning + a structured "MOCK EMAIL" block containing the link or OTP. No route raises an error if SMTP is missing; the developer copy-pastes the URL/OTP from server logs.

**Consequence in dev** : with `EMAIL_VERIFICATION_REQUIRED=True` and SMTP unset, signup works but the account is locked until the developer fetches the link from logs. Documented in `CONTRIBUTING.md` (to add).

**Production** : a real SMTP provider must be configured (Brevo, Postmark, Resend SMTP, Mailgun…). The feature can ship without it, but `EMAIL_VERIFICATION_REQUIRED` must then be set to `False` or new accounts will be unactivatable.

## Replay defense for stateless tokens

A signed JWT can be replayed until expiry. Per-flow mitigation:

- `email_verify` replayed → no-op (idempotent).
- `password_reset` replayed within 1h → could re-rotate the password. **Mitigation** : the token carries an 8-char prefix of the current `hashed_password` (`pwh_prefix` claim). On consume, if the user's current hash prefix no longer matches → reject. Once the password has been rotated once, the token is dead. (Standard pattern from Django / Devise.)
- `twofa_disable` replayed → JWT signature/expiry are still validated (so an expired replay returns 400). When the JWT is still valid and 2FA is already disabled, the second call is a no-op. No real risk: an attacker who can replay the link could only re-disable an already-disabled 2FA.

## Testing

### Backend (`backend/tests/`)

One file per flow, following existing `test_auth_*.py` style.

- `test_auth_email_verify.py` — signup without invitation → inactive + email logged; login blocked while unverified; verify with valid token → activated; expired token (+25h) → 400; already-verified → 200 idempotent; resend rate-limit (4th in 1h → 429); resend for unknown email → 200 anti-enumeration; **invitation token bypasses verification** (regression).
- `test_auth_password_reset.py` — request → email logged, 200 even for unknown email; confirm with valid token → password rotated, old rejected; expired token → 400; replay after first use → 400 via `pwh_prefix` mismatch; confirm invalidates active OTP codes; rate-limit 3/h.
- `test_auth_twofa_email_otp.py` — enable with `channel='email'` → `is_totp_enabled=True`, `totp_secret IS NULL`, `totp_channel='email'`; login without header → 200 `{requires_2fa: true, channel: 'email'}` + email logged; login with correct code → token issued; wrong code → 401, `attempts++`; 5 wrong → code dead even with the right code; resend < 30 s → 429; expired (+5m01s) → 401; reissue invalidates previous codes.
- `test_auth_twofa_recovery.py` — request for 2FA-enabled user → email logged; request for unknown / non-2FA user → 200 anti-enumeration, no email; confirm with valid token → 2FA cleared + audit; confirm replay after disable → no-op (idempotent).

### Frontend (Vitest)

One test per new page, mocking store + API:
- happy path (valid token → success state)
- error path (expired token → message + resend button)
- `LoginPage` : new `channel='email'` branch
- `ProfilePage` 2FA enable : selector toggles wording

### E2E (Playwright)

One spec `e2e/auth-email.spec.ts` covering signup → "verify email" screen → login blocked → fetch link via test-mode debug API → verify → login OK.

E2E for password-reset and 2FA-email is **not** added (covered by integration tests). CLAUDE.md rule "E2E only when touching admin-flow code" applies; mailbox E2E friction is high.

### Quality gate

`make ci` must pass. Roughly +25 backend tests + ~10 frontend tests, expected +30 s on CI duration.

## Out of scope

- **Welcome email** after verification (could be added trivially later).
- **Inbound email** (support inbox, ticket parsing).
- **Codes de récupération** (8 printable one-shot codes) — explicitly rejected during brainstorming in favor of self-serve email recovery only.
- **Per-login channel chooser** when both TOTP and email are enrolled — only one channel at a time.
- **Welcome email for invited users** — out of scope; the existing invitation email already serves that role.
- **Admin tooling** for inspecting outstanding tokens / forcing resends — not currently needed.

## Approaches considered

- **Stateless JWT for all four flows** — rejected. The 2FA login OTP must be a typeable short code with consume-once and brute-force protection; a JWT-in-URL would mean clicking a link, defeating email-as-second-factor (the user already has email access).
- **Single `email_tokens` table for everything** — rejected. Cleaner on paper, but adds a table + a service for benefits (admin auditability of in-flight tokens) the platform has not requested. Reconsider if those needs emerge.
- **Adopt Jinja2 templates now** — deferred. Four inline HTML templates remain readable and match the existing `send_invitation_email` style. Revisit beyond ~8 templates.
