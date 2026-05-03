# Audit Wave 4 — Consent & Anonymisation Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trace the participant data lifecycle end-to-end (capture → storage → anonymisation → export → erasure) and verify the consent and anonymisation pipeline matches what the consent text and GDPR practice require. Produce documentation that becomes load-bearing for the Wave 7 GDPR memo for self-hosters. Mandatory code-reviewer gate.

**Architecture:** This wave is **flow-tracing**, not code-coverage like Wave 3. The deliverable is a comprehensive lifecycle map (in `05-consent-anonymisation.md`) plus per-stage findings for any gap between the consent text's promises (`study_defaults.py:109` consent_description) and the implementation. Tests pin the discovered behaviour.

**Tech Stack:** Existing Qualis stack; pytest fixtures for participant lifecycle simulation; httpx ASGITransport for in-process tests.

---

## Reference

- **Spec:** `docs/superpowers/specs/2026-05-03-comprehensive-security-audit-design.md` (Wave 4 section).
- **Prior waves:** F-01 (prior audit), F-02 (Wave 1 scanners), F-03 (Wave 2 auth-email), F-04 (Wave 3 multi-tenant). Wave 4 uses **F-05-NNN**.
- **No carry-overs scheduled for Wave 4** in `99-action-backlog.md` (re-verify by reading the file).
- **Default consent text** (the standard against which the pipeline is measured) is at `backend/app/services/study_defaults.py:109` (`consent_description`). Key promises:
  - "Direct identifiers (such as IP addresses) are immediately converted into an anonymous code and are never stored in their original format."
  - "Pre-submission: If you withdraw before finalizing your sort, no partial data will be retained."
  - "Reporting: ... Data will be aggregated ... Qualitative comments may be quoted to contextualize these factors but will be screened to remove revealing details."

The audit's job: **verify implementation matches these promises**, and document discrepancies as findings.

## Wave 4 scope (from spec)

Files in scope:
- `backend/app/routers/participants.py` — `record_consent`, `submit`, draft endpoints.
- `backend/app/services/submission_service.py` — `record_consent` proxy + submission logic.
- `backend/app/services/storage_service.py` — S3 audio storage (key naming, lifecycle).
- `backend/app/services/export_service.py` — bulk export PII handling.
- `backend/app/routers/audio.py` — audio upload/delete/get routes.
- `backend/app/routers/admin/lifecycle.py` — `is_discarded`, `anonymised_at` admin endpoints.
- `backend/app/models/participant.py` — `is_discarded`, `consented_at`, `consent_hash`, `anonymised_at`, IP address fields.
- `backend/app/models/study.py` — `consent_title`, `consent_description`.

Out of scope: auth-email flows (Wave 2), multi-tenant isolation (Wave 3), supply chain (Wave 6), threat-model deliverables (Wave 7).

## File Structure

**Created:**
- `docs/audits/2026-05-03-comprehensive-security-audit/05-consent-anonymisation.md` — wave doc.
- `docs/audits/2026-05-03-comprehensive-security-audit/.raw/exploits/F-05-NNN.py` — per blocker/major.
- `backend/tests/security/wave_4/__init__.py`
- `backend/tests/security/wave_4/test_anonymisation_pipeline.py`
- `backend/tests/security/wave_4/test_withdrawal.py`
- `backend/tests/security/wave_4/test_audio_s3_keys.py`
- `backend/tests/security/wave_4/test_export_pii_handling.py`
- `backend/tests/security/wave_4/test_subject_rights.py` — Art. 15 + Art. 17 verification.
- `backend/tests/security/wave_4/test_pii_in_logs.py`

**Modified (depending on findings):**
- Anonymisation columns/code if `anonymised_at` doesn't actually clear all PII per consent text.
- Audio S3 lifecycle config if no auto-deletion exists.
- Export-service filters if PII bleeds through anonymisation.
- Audit logger sites if PII surfaces in logs.

**Branch:** `audit/4-consent-anonymisation` off `main`.

---

## Task 1: Scaffold Wave 4

**Files:**
- Create: `docs/audits/2026-05-03-comprehensive-security-audit/05-consent-anonymisation.md`.
- Create: `backend/tests/security/wave_4/__init__.py`.

- [ ] **Step 1.1: Confirm branch.** `git rev-parse --abbrev-ref HEAD` → `audit/4-consent-anonymisation`.
- [ ] **Step 1.2: Wave doc skeleton.** Same shape as `04-multi-tenant-isolation.md`. Sections: header (with HEAD short SHA), Scope, Inventory placeholder, Data lifecycle map placeholder, Summary count table, Findings placeholder, Resolved-since-prior placeholder, False-positives placeholder, **GDPR-memo material** placeholder (a section that captures the inventory's findings in a form Wave 7 can ingest verbatim).
- [ ] **Step 1.3: Create test dir.**
- [ ] **Step 1.4: Commit.**

```bash
git commit -am "$(cat <<'EOF'
audit(wave-4): scaffold consent and anonymisation pipeline wave

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Inventory the data lifecycle (the load-bearing task)

**Files:**
- Modify: `05-consent-anonymisation.md` — Inventory + Data lifecycle map sections.

This task is the foundation for Tasks 3-9 AND for the Wave 7 GDPR memo. Be thorough.

### Step 2.1: Trace one participant's data end-to-end

Pick a hypothetical participant journey: arrives → consents → completes Q-sort → submits. For each step, capture:

- **HTTP request** that fires (route + method).
- **DB columns written** (which tables, which fields).
- **S3 objects written** (key pattern, retention).
- **Log emissions** (which logger, what level, with what content — token? IP? email?).
- **Side-effects** (cache invalidations, emails sent, audit rows).

Then: discard / anonymise / erase paths. For each, capture which DB columns get NULL'd, which keep their values, which get hash-replaced. Capture S3 lifecycle (does the audio survive `anonymised_at`?).

Use `grep -rn 'consented_at\|anonymised_at\|is_discarded\|withdrew\|withdrawal' backend/app/` to find every site.

### Step 2.2: Compare implementation to consent text

Read `backend/app/services/study_defaults.py:109` (`consent_description` default) and any per-study override in `backend/app/models/study.py`. Note what the consent text **promises**. For each promise, identify whether the implementation matches.

Promises to verify:
1. "**IP addresses are immediately converted into an anonymous code and are never stored in their original format.**" — Read the `Participant` model. Does it store the raw IP? Or only a hash?
2. "**Pre-submission: If you withdraw before finalizing your sort, no partial data will be retained.**" — Is there a withdrawal endpoint? What happens to draft_responses on close-browser?
3. "**Reporting will aggregate ... Qualitative comments may be quoted to contextualize ... screened to remove revealing details.**" — How does export handle post-sort qualitative comments?
4. "**Exception for follow-up: ... the link between your identity (email) and your response will be maintained strictly for the duration of that specific follow-up phase.**" — Is there a "follow-up phase ended" mechanism that breaks the link?

### Step 2.3: Map the data lifecycle

Write the Data lifecycle map subsection: a numbered list (or simple state diagram in markdown) showing the participant data states:

```
1. arrived (no consent)
   └─ DB: Participant row created with session_token only
   └─ S3: nothing
   └─ Logs: HTTP access log with anonymised IP (verify)
2. consented
   └─ DB: consented_at, consent_hash set; ip_address (raw or hash?)
   └─ S3: nothing
3. submitting (drafts)
   └─ DB: draft_responses populated
4. submitted (q-sort complete)
   └─ DB: q-sort rows, optional audio recordings
   └─ S3: audio files at key /<study_slug>/<participant_token>/<recording_id>.webm
5. discarded (admin action)
   └─ is_discarded = true; queries filter on this
   └─ S3: audio still present?
6. anonymised (admin action OR scheduled?)
   └─ anonymised_at set; ip_address NULL'd; email NULL'd; consent_hash retained
   └─ S3: audio deleted? or retained?
7. erased (Art. 17 request — does this exist?)
   └─ DB rows deleted? or fully NULL'd?
   └─ S3: audio deleted?
   └─ Audit logs: erased? retained? for how long?
```

Each transition needs concrete code references (file:line) so future readers can verify.

### Step 2.4: Capture all PII fields

A table: every column on every model that contains PII. Columns: `Table | Column | PII type | Cleared by anonymisation? | Cleared by erasure? | Retention concern`.

PII fields likely include: ip_address, email (if any), session_token, resume_code, post-sort qualitative responses (free text), audio recording filenames.

### Step 2.5: GDPR-memo material section

A subsection that captures Inventory output in a form Wave 7's GDPR memo for self-hosters can ingest verbatim:

- "Personal data inventory" (the table from 2.4).
- "Data flows diagram" (the lifecycle from 2.3).
- "Operator obligations" (any per-stage operator action — e.g., "operator must explicitly call POST /lifecycle/anonymise after follow-up phase ends").

### Step 2.6: Commit

```bash
git commit -am "$(cat <<'EOF'
audit(wave-4): inventory participant data lifecycle (consent → erasure)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Tasks 3-9: per-flow audits

Each task: static + dynamic audit; find any gap; file F-05-NNN; fix or defer with rationale; regression test. Format follows the per-task discipline established in Waves 2-3.

### Task 3 — Withdrawal mechanism

**Promise:** "Pre-submission: If you withdraw before finalizing your sort, no partial data will be retained."

- Verify: is there a withdrawal endpoint? Does close-browser (no submit) leave draft_responses in DB?
- If draft_responses persist past abandonment with no cleanup → **major** (consent text is false).
- If no explicit withdrawal endpoint AND no auto-cleanup of abandoned drafts → file finding; recommend either (a) auto-cleanup after N days, or (b) a self-serve `DELETE /api/participants/{token}/draft` endpoint.
- Test: `backend/tests/security/wave_4/test_withdrawal.py`.

### Task 4 — Anonymisation completeness

**Promise:** "Direct identifiers (such as IP addresses) are immediately converted into an anonymous code and are never stored in their original format."

- Static read: when `anonymised_at` is set, what fields actually get cleared? Read the admin lifecycle endpoint that triggers anonymisation.
- Test: seed a participant with full PII, call anonymise, assert all PII columns are NULL or hashed.
- If `ip_address` is stored RAW (not hashed at write time): **major** — this contradicts the consent text directly. Fix at write time, not just at anonymisation time.
- If anonymisation leaves comments / free text unchanged (because they may legitimately need pseudonymisation rather than deletion): file as **observation**.
- Test: `backend/tests/security/wave_4/test_anonymisation_pipeline.py`.

### Task 5 — Audio S3 key naming + lifecycle

**Concern:** S3 keys can leak metadata (study slug, participant token in URL). Also: what happens to S3 objects when a participant is anonymised or erased?

- Static read: `storage_service.py` for the key-naming pattern. The Wave 3 inventory noted keys are `<study_slug>/<participant_token>/<recording_id>.webm`. Is that still the case?
- Verify: does the participant_token persist in the S3 key after `anonymised_at` is set? If yes, the audio file's metadata still links to the (formerly identifying) token.
- Lifecycle: is there a `lifecycle policy` on the bucket (auto-delete after N days)? Or does the operator have to manually clean up?
- File findings: 
  - **minor** if keys leak study_slug or participant_token to anyone with bucket-list (defence-in-depth).
  - **major** if S3 audio survives `anonymised_at` indefinitely (keeps PII voice-print attached to a former participant).
- Test: `backend/tests/security/wave_4/test_audio_s3_keys.py` — pin the key naming and the deletion behaviour.

### Task 6 — Bulk export PII handling

**Concern:** Export endpoints stream participant data. Do they include PII that should be filtered (post-anonymisation, post-discard)?

- Static read: `export_service.py` for the queries. Does it `WHERE Participant.is_discarded.is_(False) AND Participant.anonymised_at.is_(None)` to exclude both states? Or just one?
- The Wave 1 inventory noted `is_discarded` filtering exists in `exports.py`. Verify `anonymised_at` is also filtered.
- If anonymised participants appear in exports with PII still showing (because anonymisation only nulled ip but not free-text comments): file as **major** — this contradicts "Reporting ... screened to remove revealing details".
- Test: `backend/tests/security/wave_4/test_export_pii_handling.py`.

### Task 7 — Article 15 (right of access)

**Concern:** Can a participant retrieve their own data? GDPR Art. 15 requires it.

- Static read: search for any endpoint that takes a session_token (or equivalent) and returns the participant's own data, in machine-readable form. Likely candidates: `participants.py` or `submissions.py`.
- If no Art. 15 endpoint exists: file as **observation** (this is a self-hoster operator obligation, not a Qualis-software gap; the operator can satisfy Art. 15 by providing the export). Document recommended pattern in the GDPR-memo material.
- If a self-serve Art. 15 endpoint exists: verify it's authenticated by session_token only (otherwise it's a leak vector). Verify it doesn't include other participants' data.
- Test: `backend/tests/security/wave_4/test_subject_rights.py::test_article_15`.

### Task 8 — Article 17 (right to erasure)

**Concern:** Can data be erased on request? Does erasure propagate to S3? To audit logs?

- Static read: search for "erase" or "delete_participant" endpoints. Note that `is_discarded` is a soft-delete flag — does it prevent re-identification, or just hide from default queries?
- For real GDPR Art. 17 erasure (not just `is_discarded`):
  - DB rows: deleted or fully NULL'd?
  - S3 objects: deleted?
  - Audit logs: are there entries with PII that need scrubbing?
- File **major** if no real erasure path exists (only `is_discarded` flag).
- File **minor** if erasure path exists but doesn't propagate to S3.
- Test: `backend/tests/security/wave_4/test_subject_rights.py::test_article_17`.

### Task 9 — PII in logs

**Concern:** PII (IP, email, session_token, raw queries) leaking into structured/unstructured logs.

- Static read: every `logger.{info,warning,error,exception}` call site. Does any include `request.url` (covered by F-03-013 scrubber)? `participant.email`? `request.client.host` (raw IP)? Free-text from a participant's qualitative response?
- Use the Wave 2 F-03-013 scrubber as a baseline — it now scrubs `token|otp|code` from URLs in `uvicorn.access`, `app.middleware.errors`, `app.routers.logs`. But what about other PII?
- If any logger emits a raw IP or email or free-text PII: **minor** (defence-in-depth gap; main impact via log forwarding).
- Test: `backend/tests/security/wave_4/test_pii_in_logs.py` — synthetic-log corpus testing application logger output for PII.

---

## Task 10: Update action backlog

- [ ] Mark all F-05-NNN entries closed/deferred under `## Wave 4 — Consent & anonymisation pipeline` of `99-action-backlog.md`.
- [ ] Add Wave 7 follow-ups for items the Wave 7 GDPR memo will address.
- [ ] Commit.

---

## Task 11: Final CI + push + PR + code-reviewer gate

- [ ] **Step 11.1:** `make ci` green.
- [ ] **Step 11.2:** Push.
- [ ] **Step 11.3:** Open PR titled `audit(wave-4): consent & anonymisation pipeline`.
- [ ] **Step 11.4: Dispatch `superpowers:code-reviewer` (Opus)** with brief: the wave doc, the diff, all per-flow tests, and explicit prompts:
  - "Does the wave doc's data lifecycle map cover the four consent-text promises explicitly?"
  - "For each finding marked closed: does the regression test actually pin the fix, or just smoke-test the code path?"
  - "For findings deferred to Wave 7: is the deferral defensible?"

---

## Per-task discipline (Tasks 3-9)

Each finding-task ships:
1. Static analysis writeup in the wave doc.
2. Exploit script (blocker/major) under `.raw/exploits/`.
3. Fix in code (or defer with rationale).
4. Regression test under `backend/tests/security/wave_4/`.
5. Wave doc finding section (eight-field schema).
6. Backlog entry.
7. Commit per finding.

## Stop criteria

- A finding requires changing the consent text (which is editable per-study and shipped as a default) → escalate; this is a product/legal decision, not a security fix.
- Anonymisation gaps require a schema migration that's not additive (e.g., dropping a column) → defer with rationale to Wave 7 or backlog.
- Article 15 / 17 endpoints requiring substantial new feature work → file finding, defer implementation to Wave 4b PR (similar to Wave 2's Task 10 deferral).

## Out of scope

- Auth-email flows (Wave 2).
- Multi-tenant isolation (Wave 3).
- Threat model / SECURITY.md / GDPR memo deliverables (Wave 7) — Wave 4 produces *material* for the memo; Wave 7 writes it.
- Per-study consent_description audit (operator responsibility — covered by GDPR memo).

---

## Self-Review

Spec coverage check (against `2026-05-03-comprehensive-security-audit-design.md`, Wave 4 section):

- ✅ End-to-end trace of one participant's data → Task 2.
- ✅ Storage location (DB + S3 keys) → Task 2 + Task 5.
- ✅ What `anonymised_at` flips → Task 4.
- ✅ Audio key naming reveals → Task 5.
- ✅ Withdrawal mechanism → Task 3.
- ✅ Article 15 access path → Task 7.
- ✅ Article 17 erasure propagation to S3 → Task 8.
- ✅ Retention TTL → Task 5 (S3 lifecycle) + Task 8 (DB retention).
- ✅ PII in audit logs → Task 9.
- ✅ IP addresses in access logs → Task 9 (covered by scrubber audit) + Task 4 (IP storage).
- ✅ Email addresses in error traces → Task 9.
- ✅ GDPR-memo material section → Task 2.5 (load-bearing for Wave 7).
- ✅ Code-reviewer gate → Task 11.4.

ID-space consistency: F-05-NNN. No collisions with prior waves.

Placeholder scan: `<HEAD short SHA>`, `<sha>` are designed-in slots filled at runtime.

## Execution Handoff

**Plan complete.** Subagent-driven recommended.
