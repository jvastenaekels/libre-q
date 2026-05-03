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
| `scanners/wave-1/gitleaks.json` | gitleaks | <TBD> | <TBD> |
| `scanners/wave-1/pip-audit.json` | pip-audit | <TBD> | <TBD> |
| `scanners/wave-1/bandit.json` | bandit | <TBD> | <TBD> |
| `scanners/wave-1/npm-audit.json` | npm | <TBD> | <TBD> |
| `scanners/wave-1/semgrep.json` | semgrep | <TBD> | <TBD> |

## Exploits (filled in Waves 2-6)

| File | Finding | PRE-FIX assertion | POST-FIX assertion |
|------|---------|-------------------|--------------------|
| _empty for Wave 1_ | | | |
