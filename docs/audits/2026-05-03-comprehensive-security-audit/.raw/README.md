# Comprehensive Security Audit — Raw Outputs Index

**Started:** 2026-05-03
**Baseline:** `docs/audits/2026-04-25-deep-audit/.raw/`
**Throwaway tools:** `/tmp/audit-bin/` (gitleaks), `/tmp/audit-venv/` (semgrep)

The actual files under `scanners/` and `exploits/` are gitignored
(`docs/audits/*/.raw/*` with `!.raw/README.md` exception). This README
is committed so the audit is auditable.

## Wave 1 — Scanners (filled in Task 3)

| File | Tool | Version | Notes |
|------|------|---------|-------|
| `scanners/wave-1/gitleaks.json` | gitleaks | 8.18.4 | 14 hits **pre-allowlist** — all false positives: `AKIAIOSFODNN7EXAMPLE` in docs (7×), `123e4567-…` UUIDs in test fixtures (6×), one UUID in test_study_lifecycle.py; triaged in Task 4. The committed JSON reflects the **post-allowlist** state (0 hits). To reproduce the 14-hit pre-allowlist scan: `mv .gitleaksignore .gitleaksignore.bak && /tmp/audit-bin/gitleaks detect --source . && mv .gitleaksignore.bak .gitleaksignore`. |
| `scanners/wave-1/pip-audit.json` | pip-audit | 2.10.0 | 4 vulnerable packages: pip (CVE-2026-3219), pygments (CVE-2026-4539), python-dotenv (CVE-2026-28684), requests (CVE-2026-25645) |
| `scanners/wave-1/bandit.json` | bandit | 1.9.3 | 0 high, 0 medium, 2 low — B105 false positives: string literals 'qualis' and 'auth-email' flagged as hardcoded passwords in security.py token-type constants |
| `scanners/wave-1/npm-audit.json` | npm | 11.12.1 | 1 high (xlsx — Prototype Pollution in SheetJS), 0 moderate, 0 low |
| `scanners/wave-1/semgrep.json` | semgrep | 1.161.0 | 7 findings: 1× missing Dockerfile USER, 4× avoid-sqlalchemy-text (test router + migration scripts), 1× nginx request-host header |

## Exploits (filled in Waves 2-6)

| File | Finding | PRE-FIX assertion | POST-FIX assertion |
|------|---------|-------------------|--------------------|
| `exploits/F-03-004.py` | F-03-004 (OTP brute-force, Wave 2 Task 4) | 100 wrong OTP attempts run unimpeded across 20 issue/verify cycles → script exits 1 | `OTPLockoutError` raised at attempt 30 (cap kicks in) → script exits 0 |
