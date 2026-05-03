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

_Filled by Task 2._

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
