# Wave 2 — Auth-Email Flows

**Date:** 2026-05-03
**Auditor:** Claude Opus 4.7
**Codebase ref:** commit `71ea5073` of `audit/2-auth-email-flows`

## Scope

Files audited:
- `backend/app/services/email_token_consume_service.py`
- `backend/app/services/email_otp_service.py`
- `backend/app/middleware/log_scrub.py`
- `backend/app/routers/auth.py`
- migrations `cb8732294475_add_auth_email_flows.py`, `fd88287d3f9b_fix_password_changed_at_default.py`

Carry-over: F-01-010 (JWT lifetime + revocation).

## Inventory

This section is orientation, not findings. It traces tokens, codes, denylists and
loggers through the six in-scope files and their immediate dependencies, so the rest
of the audit (Tasks 3-10) can be read without going back to source.

### Token lifecycles

Five token-shaped artefacts cross the auth-email perimeter. Four are JWTs minted
through `create_email_token` / `create_access_token` in
`backend/app/utils/security.py`; the fifth is a numeric OTP managed end-to-end by
`email_otp_service.py`. The `iss` / `aud` pair (`qualis` / `auth-email`) is shared by
the three email-link JWTs and is verified by `decode_email_token` (`security.py:144-154`).

1. **Signup-confirmation token (`purpose="email_verify"`).**
   - Issued in `auth.py:298-304` (registration path) and `auth.py:565-571`
     (`/email/verify/resend`).
   - Claims (per `create_email_token`, `security.py:106-136`):
     `iss="qualis"`, `aud="auth-email"`, `sub=<email>`, `purpose="email_verify"`,
     `iat`, `exp` (`now + 24h` from registration; from the resend route the lifetime
     comes from `settings.EMAIL_VERIFY_TOKEN_EXPIRE_HOURS`, default 24h),
     `jti=secrets.token_urlsafe(16)`. No `pwa`.
   - Email body: `send_email_verification` (`utils/email.py:131-150`); subject
     "Verify your Qualis account"; URL is `{FRONTEND_URL}/verify-email?token={token}`.
   - Consumed in `auth.py:514-544` (`POST /email/verify`). Side-effects on first
     use: sets `user.email_verified_at = now()`, sets `user.is_active = True`,
     emits `email_verify` audit row. Idempotent: if `email_verified_at` is already
     set the route still returns 200 without DB writes (`auth.py:534-544`).
   - **JTI-tracked? No.** The token relies on the `email_verified_at IS NULL`
     branch alone for single-use semantics. Replay after consume is harmless
     because the gate short-circuits, but the token remains accepted until `exp`.
     (Flagged for Tasks 3 / 8.)

2. **Password-reset token (`purpose="password_reset"`).**
   - Issued in `auth.py:606-614` (`POST /password/reset/request`).
   - Claims: same envelope as above plus mandatory `pwa` claim — the user's
     `password_changed_at` encoded as **microsecond** epoch
     (`int(password_changed_at.timestamp() * 1_000_000)`, `security.py:134`).
     Lifetime = `settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS` (default 1h).
   - Email body: `send_password_reset` (`utils/email.py:153-172`); URL is
     `{FRONTEND_URL}/reset-password?token={token}`.
   - Consumed in `auth.py:619-656` (`POST /password/reset/confirm`).
     `decode_email_token` validates signature, `iss`, `aud`, `exp`, and `purpose`.
     The router additionally re-derives `pwa_now` from
     `user.password_changed_at` and rejects the token with
     `400 token_already_consumed` if the two values disagree (`auth.py:639-643`).
   - Side-effects on success: rotate `hashed_password`, set
     `password_changed_at = now()`, call `invalidate_active_otps(db, user)`
     (kills any in-flight 2FA-email OTPs), emit `password_reset_confirm`
     audit row.
   - **JTI-tracked? No.** Single-use enforced by the `pwa` round-trip: rotating
     the password updates `password_changed_at` and any stale token's `pwa`
     no longer matches. (Flagged for Task 6 — the rotation does not invalidate
     the **access JWT** issued from `/token`, which has `subject=email` and
     no `pwa`.)

3. **Email-change confirmation token.** **Does not exist.** `PATCH /me`
   (`auth.py:312-353`) accepts `user_update.email`, checks uniqueness, and
   writes the new value directly. There is no second-factor email loop:
   no token issued to either the old or the new address. (Flagged for Task 7.)

4. **2FA-disable token (`purpose="twofa_disable"`).**
   - Issued in `auth.py:677-685` (`POST /2fa/disable/request`). Lifetime =
     `settings.TWOFA_DISABLE_TOKEN_EXPIRE_MINUTES` (default 15 min).
   - Claims: same envelope as `email_verify` (no `pwa`).
   - Email body: `send_twofa_disable_link` (`utils/email.py:175-196`);
     URL is `{FRONTEND_URL}/2fa/disable?token={token}`.
   - Consumed in `auth.py:693-747` (`POST /2fa/disable/confirm`).
     `mark_jti_consumed` runs **before** the user lookup (`auth.py:719`), so
     the row is inserted (and the JTI burned) regardless of whether the
     subject email maps to a real user — anti-enumeration.
     `IntegrityError` on duplicate JTI maps to `409 token_already_consumed`.
   - Side-effects on first valid use: set `is_totp_enabled=False`, null
     `totp_secret` and `totp_channel`, send `send_twofa_disabled_notification`
     to the user (with ISO-8601 timestamp and best-effort client IP from
     `request.client.host`), emit `twofa_disable_confirm` audit row.
   - **JTI-tracked? Yes** — only flow that writes to `consumed_email_tokens`.

5. **2FA email-OTP code (numeric, not a JWT).**
   - Issued in `email_otp_service.issue_otp` (`email_otp_service.py:40-63`),
     called from `auth.py:131` during the email-channel branch of `/token`.
   - Format: 6-digit string `f"{secrets.randbelow(1_000_000):06d}"`
     (`email_otp_service.py:55`). Storage: row in `twofa_email_otp_codes`
     with bcrypt-hashed code (`get_password_hash`, `email_otp_service.py:58`),
     `expires_at = now + TWOFA_EMAIL_OTP_EXPIRE_MINUTES`,
     `attempts=0`, `used_at=NULL`.
   - Email body: `send_twofa_login_otp` (`utils/email.py:224-244`); subject
     "Your Qualis login code"; the plaintext code is rendered inline in HTML.
   - Verified in `email_otp_service.verify_otp` (`email_otp_service.py:66-76`),
     called from `auth.py:139`. Failure increments `row.attempts`; success
     sets `row.used_at = now`. The row is rejected outright if
     `expires_at <= now` or `attempts >= 5`.
   - Resend cooldown: `issue_otp` raises `OTPRateLimitError` if a non-used
     code from the same user was created within
     `TWOFA_EMAIL_OTP_RESEND_COOLDOWN_SECONDS` (default 30s). `auth.py:131-134`
     maps the exception to `HTTP 429`.
   - **JTI-tracked? N/A** (not a JWT). Single-use is the `used_at IS NULL`
     filter on `_get_active_code` (`email_otp_service.py:27-37`).

### JTI denylist

Schema (`consumed_email_tokens`, migration
`backend/db_migrations/versions/cb8732294475_add_auth_email_flows.py:24-29`,
ORM `app/models/email_token.py:16-23`):

| Column        | Type                       | Constraints                       |
|---------------|----------------------------|-----------------------------------|
| `jti`         | `String`                   | `PRIMARY KEY` (uniqueness on JTI) |
| `purpose`     | `String`                   | `NOT NULL`                        |
| `consumed_at` | `DateTime(timezone=True)`  | `NOT NULL`, `server_default=NOW()`|

The PK on `jti` is the race-defense mechanism: concurrent attempts to consume
the same token race on `INSERT`; exactly one wins, the other raises
`IntegrityError`. `auth.py:719-722` traps that error and returns
`409 token_already_consumed`. (Flagged for Task 3 — the read-then-insert
pattern in `is_jti_consumed` is unused; the actual gate is the PK collision.)

**Cleanup:**
- `cleanup_consumed(db, older_than)` (`email_token_consume_service.py:31-36`)
  bulk-deletes rows older than the cutoff.
- The only caller is `backend/scripts/cleanup_consumed_email_tokens.py`
  (`older_than=timedelta(days=7)`).
- The script is **not scheduled** by `Procfile` (only `postdeploy` and `web`
  process types are declared). No cron, no Scalingo scheduler entry checked
  in. So the table grows monotonically at ~one row per 2FA-disable
  confirmation in production. (Flagged for Task 3 — capacity-only concern,
  not a security finding.)

**Usage sites of the JTI helpers** (whole repo):
- `mark_jti_consumed` — exactly one production call site:
  `auth.py:719` (twofa_disable_confirm). Tests:
  `tests/unit/test_email_token_consume_service.py:23, 28, 31`.
- `is_jti_consumed` — **no production callers.** Defined and tested only
  (`tests/unit/test_email_token_consume_service.py:20, 25, 51-52`,
  `vulture_whitelist.py:374`). The 2FA-disable flow uses the PK-collision
  pattern instead.
- `cleanup_consumed` — script + tests, as above
  (`vulture_whitelist.py:375`).

### OTP entropy + rate limits

Source: `backend/app/services/email_otp_service.py`,
`backend/app/routers/auth.py:78-179`,
`backend/app/core/config.py:77-78`.

- **Entropy.** Code length 6 decimal digits, character set `[0-9]`, drawn from
  `secrets.randbelow(1_000_000)` (`email_otp_service.py:55`). Range
  0–999_999 → ~19.93 bits of entropy per code.
- **Hashing at rest.** Codes stored bcrypt-hashed in `twofa_email_otp_codes.code_hash`
  via `get_password_hash` (default bcrypt cost). Plaintext lives only in the
  `issue_otp` return value and the email body; never persisted.
- **Per-row attempt cap.** `verify_otp` rejects rows with `attempts >= 5`
  (`email_otp_service.py:70`). Failed attempts increment `row.attempts`
  (`email_otp_service.py:73`) but the increment is only flushed if the
  surrounding request commits — `auth.py:140` always commits regardless of
  outcome, so the counter persists. After 5 failures the row is dead, but a
  new `issue_otp` call (subject to the 30 s resend cooldown) creates a fresh
  row with `attempts=0`. (Flagged for Task 4 — there is no per-user lifetime
  cap on issuance, only the 30 s gap between issuances.)
- **Resend cooldown.** `TWOFA_EMAIL_OTP_RESEND_COOLDOWN_SECONDS` default 30
  (`config.py:78`). Enforced in `issue_otp` (`email_otp_service.py:46-51`).
- **Expiry.** `TWOFA_EMAIL_OTP_EXPIRE_MINUTES` default 5 (`config.py:77`).
  Enforced both at issue time (`expires_at = now + delta`,
  `email_otp_service.py:59`) and verify time (`row.expires_at <= now`,
  `email_otp_service.py:70`).
- **Issue endpoint rate limits.** OTP issuance is **not a standalone endpoint**.
  It piggybacks on `POST /token` (`auth.py:78-179`) when the user has 2FA
  enabled with `totp_channel='email'`. The route carries
  `@limiter.limit("5/minute")` (`auth.py:79`) keyed by `_get_real_ip`
  (`limiter.py:15-39`). There is **no email-hash key** on `/token`, only on
  `/email/verify/resend`, `/password/reset/request`, and `/2fa/disable/request`
  (`auth.py:548-549, 580-581, 660-661`, all 3/hour per IP + 3/hour per
  email-hash). (Flagged for Task 4 — 5/minute per IP allows ~7200 issuances
  per day per attacker IP; combined with 6-digit entropy and a 30 s cooldown
  per *user*, the dominating cost is the OTP cooldown, not the route limit.)

### Log scrubbing

Source: `backend/app/middleware/log_scrub.py`.

- **Regex.** `re.compile(r"([?&])([Tt]oken)=[^&]*")` (line 17). Replaces
  `?token=…` and `&token=…` (also `?Token=…`) with `?token=REDACTED`. Anchors
  on a `?` or `&` separator and a literal `token=` key. Stops at the next `&`
  or end-of-string.
- **Loggers it attaches to.** Only `uvicorn.access`
  (`log_scrub.py:42`, called from `app/main.py:53`). The filter mutates
  `record.args` in place so the rendered access-log line never carries the
  raw token. The companion defense is `Referrer-Policy: no-referrer` on the
  consume pages (mentioned in the module docstring; verified in
  `app/middleware/security.py` is out-of-scope here, flagged for Task 9).
- **Loggers it does NOT attach to.** Every application logger created via
  `logging.getLogger(__name__)` is unfiltered. Inventory of those (from
  `grep -rE 'logger = logging.getLogger' backend/app/`):
  `app.middleware.errors`, `app.utils.email`, `app.routers.auth`,
  `app.routers.admin.exports`, `app.routers.admin.studies_import_export`,
  `app.utils.audit` (`app.audit`), `app.main`, `app.routers.admin.memos`,
  `app.routers.admin.concourses`, `app.services.study_service`,
  `app.services.concourse_service`, `app.routers.submissions`,
  `app.routers.admin.analysis`, `app.schema_validation`,
  `app.routers.admin.studies`, `app.routers.logs` (`frontend_error`),
  `app.routers.admin.studies_participants`, `app.routers.admin.projects`,
  `app.routers.admin.lifecycle`, `app.services.storage_service`,
  `app.services.analysis_service`, `app.services.study_data_service`,
  `app.services.submission_service`, `app.services.export_service`. The
  routes most likely to receive a tokenised path in their own log lines
  are `app.routers.auth` (200/400/409/422 rendering) and
  `app.middleware.errors` (500 traceback handler — would log the request URL
  if `exc_info` includes the request). (Flagged for Task 9.)

### Session/JWT lifetime

Source: `backend/app/core/config.py:15-19`,
`backend/app/utils/security.py:46-61`,
`backend/app/dependencies.py:32-60`,
`backend/db_migrations/versions/fd88287d3f9b_fix_password_changed_at_default.py`.

- **Algorithm + secret.** `settings.ALGORITHM = "HS256"` (`config.py:17`);
  `settings.SECRET_KEY` is HS256-symmetric, default
  `"CHANGEME-insecure-dev-only"` (`config.py:16`), env-overridable. Same key
  signs the `/token` access JWT, the email-link JWTs, and the invitation JWT.
- **Lifetime.** `settings.ACCESS_TOKEN_EXPIRE_MINUTES = 480` (8h,
  `config.py:18`). The default is hard-coded in
  `create_access_token` (`security.py:46-61`); the route at `auth.py:173-176`
  passes the configured value explicitly.
- **Claims on the access JWT.** Only `sub=<email>` and `exp`
  (`security.py:57`). No `iat`, `iss`, `aud`, `jti`, **no `pwa`**, no role,
  no scope. `decode` happens in `dependencies.get_current_user`
  (`dependencies.py:42-44`), which validates only signature + algorithm + `exp`
  (default `jwt.decode` behaviour) and looks up the user by `email`.
- **`password_changed_at` on JWT decode.** `grep` for `password_changed_at`
  in `app/utils/security.py` and `app/dependencies.py`: **zero matches**
  on any decode path. The field is read by `auth.py:611, 640` (issue and
  consume password-reset tokens) and by `models/user.py:42-47`. The
  `get_current_user` flow does not consult it, so an access JWT minted before
  a password rotation remains valid until its `exp` (up to 8h later).
- **`fix_password_changed_at_default` migration
  (`fd88287d3f9b_fix_password_changed_at_default.py`).** The previous
  migration (`cb8732294475`) added `password_changed_at` as nullable, backfilled
  existing rows with `NOW()`, then `alter_column` to NOT NULL — without ever
  setting a DDL-level `server_default`. Any subsequent INSERT that omitted
  the column failed the NOT NULL constraint. `fd88287d3f9b` re-asserts
  `server_default=NOW()` so future INSERTs (raw SQL or any path bypassing
  the ORM-side `default=lambda: datetime.now(timezone.utc)`) succeed.
  Functional fix; no security implication beyond not breaking the password-
  rotation flow.
- Whether the lifetime/revocation gap (carry-over F-01-010) holds in current
  code is verified in Tasks 6 + 10.

### Configuration table

Every `settings.<NAME>` consulted by the six in-scope files (or by their
direct dependencies that are reached from those files). Defaults and env-var
mappings come from `backend/app/core/config.py`.

| Name                                       | Default                           | Env var                                  | Purpose                                                                                                  |
|--------------------------------------------|-----------------------------------|------------------------------------------|----------------------------------------------------------------------------------------------------------|
| `SECRET_KEY`                               | `"CHANGEME-insecure-dev-only"`    | `SECRET_KEY`                             | HS256 signing key shared by access JWT, email-link JWTs, and invitation JWTs.                             |
| `ALGORITHM`                                | `"HS256"`                         | `ALGORITHM`                              | JWT signing algorithm (`security.py:59, 100, 147`; `dependencies.py:43`).                                 |
| `ACCESS_TOKEN_EXPIRE_MINUTES`              | `480` (8h)                        | `ACCESS_TOKEN_EXPIRE_MINUTES`            | `/token` access-JWT lifetime (`auth.py:173`).                                                             |
| `FRONTEND_URL`                             | `"http://localhost:5173"`         | `FRONTEND_URL`                           | Base URL embedded into every email-link token URL (`auth.py:303, 570, 613, 684`).                         |
| `EMAIL_VERIFICATION_REQUIRED`              | `True`                            | `EMAIL_VERIFICATION_REQUIRED`            | Operator opt-in for the verification gate. Combined with SMTP config to derive `email_verification_active`.|
| `EMAIL_VERIFY_TOKEN_EXPIRE_HOURS`          | `24`                              | `EMAIL_VERIFY_TOKEN_EXPIRE_HOURS`        | Lifetime of the email-verify JWT issued by the resend route (`auth.py:568`).                              |
| `PASSWORD_RESET_TOKEN_EXPIRE_HOURS`        | `1`                               | `PASSWORD_RESET_TOKEN_EXPIRE_HOURS`      | Lifetime of the password-reset JWT (`auth.py:610`).                                                       |
| `TWOFA_DISABLE_TOKEN_EXPIRE_MINUTES`       | `15`                              | `TWOFA_DISABLE_TOKEN_EXPIRE_MINUTES`     | Lifetime of the 2FA-disable JWT (`auth.py:681`).                                                          |
| `TWOFA_EMAIL_OTP_EXPIRE_MINUTES`           | `5`                               | `TWOFA_EMAIL_OTP_EXPIRE_MINUTES`         | Lifetime of an email-OTP code row (`email_otp_service.py:59`).                                            |
| `TWOFA_EMAIL_OTP_RESEND_COOLDOWN_SECONDS`  | `30`                              | `TWOFA_EMAIL_OTP_RESEND_COOLDOWN_SECONDS`| Per-user issue cooldown (`email_otp_service.py:46-51`).                                                   |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD`| `None`                            | (matching env var per name)              | Drives `is_smtp_configured`; if any is empty, `_send_or_log` writes the email body to stdout.             |
| `EMAILS_FROM_EMAIL` / `EMAILS_FROM_NAME`   | `None`                            | (matching env var per name)              | From address / display name for outbound mail. `effective_emails_from_name` falls back to `PROJECT_NAME`. |
| `TRUSTED_PROXIES`                          | `""` (empty list)                 | `TRUSTED_PROXIES`                        | Trust gate for `X-Forwarded-For` in `_get_real_ip` (`limiter.py:30-39`).                                  |
| `IP_HASH_SALT`                             | `"CHANGEME-insecure-dev-only"`    | `IP_HASH_SALT`                           | Salt for IP-hashing in audit logs (consumed by `app.utils.audit` reached from `auth.py`).                 |
| `ENVIRONMENT`                              | `"production"`                    | `ENVIRONMENT`                            | Tags Sentry events; toggles dev-only behaviours elsewhere.                                                |

Derived properties consulted from in-scope files:

- `settings.email_verification_active` (`config.py:146-151`) — true iff
  `EMAIL_VERIFICATION_REQUIRED` is set **and** `is_smtp_configured`.
  Read in `auth.py:117, 242` to gate the post-password verification check on
  `/token` and to choose between the active-from-creation and
  pending-verification paths in `/register`.
- `settings.is_smtp_configured` (`config.py:135-143`) — feeds the above and
  controls `_send_or_log`'s send-vs-log fallback.
- `settings.trusted_proxies_list` (`config.py:42-43`) — consumed by
  `_get_real_ip` for the `X-Forwarded-For` trust gate, which keys all the
  rate limiters declared on `auth.py`.

## Summary

| Severity | Count |
|----------|-------|
| blocker | 0 |
| major | 0 |
| minor | 0 |
| observation | 0 |

## Findings

_Populated as findings are filed by Tasks 3-9._

## F-01-010 — JWT lifetime + revocation (carry-over)

_Status section filled by Task 10._

## Resolved since prior

_Listed by Task 11 if any prior auth-related findings were closed by intervening commits._

## False positives — not filed
