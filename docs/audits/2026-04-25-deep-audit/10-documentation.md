# Axis 10 — Documentation

**Auditor:** Claude (Sonnet 4.6) — 2026-04-25
**Pass type:** Standard (automated + targeted manual)
**Inputs:** interrogate-coverage.txt, lychee-links.json, citation-validation.txt, openapi-sync.log; manual review of README.md, CLAUDE.md, CITATION.cff, LICENSE, docs/ tree

---

## Summary

| Dimension | Status |
|-----------|--------|
| Docstring coverage (overall) | 81% — passes 80% gate |
| Docstring coverage (services) | 74% avg — one service at 41%, one at 52% |
| Broken internal links | 2 errors (same phantom file, 2 occurrences) |
| OpenAPI generated client | **In sync** — `git diff` clean after regeneration |
| LICENSE | Present, AGPL v3, intact |
| CITATION.cff | Valid (schema 1.2.0) — 3 TODO stubs remain |
| README — SoftwareX sections | 5 of 8 required sections present; 3 missing |
| Critical Q framing in docs/ | Absent from `docs/explanation/q-methodology.md` |
| CLAUDE.md migration chain | Stale — documents 6 of 15 migrations |

---

## Findings

### F-10-001 : README missing Statement of Need section

- **Severity:** major
- **Audience:** [SoftwareX]
- **Location:** `README.md` (entire file)
- **Observation:** SoftwareX requires a "Statement of Need" section that articulates the problem the software solves, why existing tools are insufficient, and the target community. The README contains a feature comparison table ("Why Libre-Q?") and a feature list, but no prose section explicitly framing the unmet need in the research community. The comparison table names FlashQ/HTMLQ, PQMethod, and Ken-Q but does not explain *why* they are insufficient (e.g., no integrated end-to-end workflow, no self-hosted data collection + analysis combination, no critical Q flexibility). SoftwareX editors check for this section by name; its absence is a standard desk-reject trigger.
- **Impact:** Likely desk reject or mandatory revision request at SoftwareX submission. The table alone does not satisfy this criterion per the SoftwareX Guide for Authors.
- **Recommendation:** Add a `## Statement of Need` section (2–4 paragraphs) above "Key Features" covering: (1) the gap in Q-methodology tooling — existing tools separate data collection from analysis, or are desktop-only, or lack self-hosted options; (2) target audience (social researchers, health researchers, critical Q practitioners); (3) what Libre-Q uniquely enables. The comparison table can remain as a complement.
- **Effort:** S

---

### F-10-002 : README missing Acknowledgments section

- **Severity:** minor
- **Audience:** [SoftwareX]
- **Location:** `README.md` (end of file)
- **Observation:** No `## Acknowledgments` section is present. SoftwareX's submission checklist recommends acknowledging funding sources, institutional support, and any prior work the software builds upon (e.g., Brown 1980 for centroid extraction, the `qmethod` R package for export compatibility). The README ends with `## License` and has no acknowledgment block.
- **Impact:** Not an automatic desk reject, but reviewers note its absence; it also signals that funding/institutional provenance is undocumented, which matters for open-science credibility.
- **Recommendation:** Add a short `## Acknowledgments` section acknowledging institutional affiliation (URCA), any grant funding, and citing the foundational Q-methodology literature that informed the factor analysis implementation (Brown 1980, Watts & Stenner 2012).
- **Effort:** S

---

### F-10-003 : README missing Citation section

- **Severity:** major
- **Audience:** [SoftwareX]
- **Location:** `README.md` (end of file)
- **Observation:** The README has no `## Citation` or `## How to Cite` section pointing users to the CITATION.cff or providing a copyable citation snippet. `CITATION.cff` exists and is valid, but it is only discoverable via GitHub's "Cite this repository" button — not from the README itself. SoftwareX explicitly requires citation instructions in the README.
- **Impact:** SoftwareX reviewers will flag this. Users installing from source (not GitHub) have no citation guidance.
- **Recommendation:** Add a `## Citation` section with: (1) a one-liner APA/BibTeX snippet for the software itself; (2) a note that the accompanying SoftwareX article should be cited once published; (3) a reference to `CITATION.cff`. Template: `If you use Libre-Q in your research, please cite: [BibTeX block]`.
- **Effort:** S

---

### F-10-004 : CITATION.cff has three unresolved TODO stubs

- **Severity:** major
- **Audience:** [SoftwareX]
- **Location:** `CITATION.cff:12`, `CITATION.cff:16`, `CITATION.cff:23-24`
- **Observation:** Three blocking TODOs remain in the validated CITATION.cff:
  1. `date-released: "2026-04-16"  # TODO: update to actual release date when v0.1.0 is tagged` — no `v0.1.0` Git tag exists yet; the date is a placeholder.
  2. The `doi` field is commented out: `# doi: "10.5281/zenodo.XXXXXXX"` — Zenodo deposit has not been created.
  3. Both authors are missing ORCIDs: `# TODO: add ORCID`.
  The file is schema-valid (as confirmed by citation-validation.txt) because these fields are optional in CFF 1.2.0, but SoftwareX submission requires a real Zenodo DOI and strongly recommends ORCIDs.
- **Impact:** Submission cannot proceed without a Zenodo DOI. Missing ORCIDs reduce discoverability and reviewer confidence.
- **Recommendation:** (1) Create the `v0.1.0` Git tag on the final pre-submission commit and update `date-released`. (2) Deposit to Zenodo (link GitHub repo → Zenodo webhook, tag → auto-deposit), then fill in the DOI. (3) Add both authors' ORCIDs. Cross-reference: F-12 covers the version tag and Zenodo deposit as blockers.
- **Effort:** M

---

### F-10-005 : CLAUDE.md migration chain documents only 6 of 15 migrations (cross-ref F-09-005)

- **Severity:** minor
- **Audience:** [Maintenance]
- **Location:** `CLAUDE.md:62`
- **Observation:** The migration chain in CLAUDE.md reads:
  `initial_schema → rename_randomize... → remove_consent_buttons → add_pre_instruction → add_is_test_run → add_audio_recordings_table`
  The actual chain in `backend/db_migrations/versions/` has 15 migrations in sequence:
  `initial_schema → rename_randomize_statements_to_ → remove_consent_buttons → add_pre_instruction → add_is_test_run_to_participants → add_audio_recordings_table → add_statement_display_order → add_last_step_reached → fix_last_step_reached_backfill → add_draft_responses → add_resume_code → add_concourse_tables → add_statement_concourse_traceability → add_item_versions_and_comments → rename_workspace_to_project`
  Nine migrations added after the last CLAUDE.md update are not documented. This finding is a documentation-angle cross-reference to F-09-005, which flags the same staleness from a reproducibility angle.
- **Impact:** An agent or contributor reading CLAUDE.md will have a misleading picture of schema history. When debugging a migration failure or reviewing the chain, they will miss 9 steps. Coupled with the `add_resume_code` and `add_concourse_tables` migrations — which introduce significant schema surface — this creates cognitive debt.
- **Recommendation:** Update the migration chain line in CLAUDE.md to reflect all 15 steps (abbreviated names are fine). Note: this is a minor update, not a structural fix. Automation (a Makefile target that prints the chain) is a separate improvement. See also F-09-005.
- **Effort:** S

---

### F-10-006 : Broken internal link in agent-instructions.md references deleted schemas.py

- **Severity:** minor
- **Audience:** [Maintenance]
- **Location:** `docs/contributing/agent-instructions.md:17`, `docs/contributing/agent-instructions.md:54`
- **Observation:** Lychee found 2 broken file links (both pointing to the same phantom path):
  `file:///home/julien/libre-q/backend/app/schemas.py`
  The file `backend/app/schemas.py` does not exist. Schemas are now organized as a package in `backend/app/schemas/` (with `analysis.py`, `studies.py`, etc.). The agent-instructions document was written before the schemas were split into a package and was not updated when the refactor occurred.
- **Impact:** An AI coding agent reading agent-instructions.md will try to open a file that does not exist, or be directed to look in the wrong place. This can cause wasted lookup cycles or incorrect code placement. Since agent-instructions.md is explicitly labeled "for AI coding assistants," this is a meaningful friction point.
- **Recommendation:** Replace both occurrences of `backend/app/schemas.py` in agent-instructions.md with `backend/app/schemas/` (the package directory), and update the surrounding prose to reflect that schemas are split by domain. Two occurrences: line 17 (architecture overview table) and line 54 (backend feature workflow step 1).
- **Effort:** S

---

### F-10-007 : Services docstring coverage — two services below 60%

- **Severity:** minor
- **Audience:** [Maintenance]
- **Location:** `backend/app/services/concourse_service.py` (41%), `backend/app/services/study_service.py` (52%)
- **Observation:** From interrogate-coverage.txt, services sub-totals:
  - `services/analysis_service.py`: 100%
  - `services/concourse_service.py`: 41% (16 of 27 public symbols undocumented)
  - `services/export_service.py`: 93%
  - `services/recruitment_service.py`: 90%
  - `services/storage_service.py`: 100%
  - `services/study_data_service.py`: 100%
  - `services/study_service.py`: 52% (13 of 27 public symbols undocumented)
  - `services/submission_service.py`: 100%
  Overall services weighted average: ~74%. The two low-coverage services (`concourse_service` and `study_service`) are among the most complex in the codebase (27 public symbols each) and the most likely to be extended by contributors.
  Note: the 80% gate applies to the entire `app/` module, not services specifically. Overall gate passes (81%). Per-scoping rules, docstring coverage below 30% on services would be major; 30-70% is minor.
- **Impact:** Contributors modifying `study_service.py` or `concourse_service.py` face higher cognitive overhead without docstrings on the most complex functions. Not a SoftwareX risk; primarily a maintenance friction point.
- **Recommendation:** Add module-level and function-level docstrings to the undocumented public functions in `concourse_service.py` and `study_service.py`, prioritizing those with non-obvious parameters or side effects. Aim for ≥70% on each service file. This can be done incrementally as functions are modified.
- **Effort:** M

---

### F-10-008 : OpenAPI generated client is in sync (informational)

- **Severity:** observation
- **Audience:** [Maintenance]
- **Location:** `openapi-sync.log`
- **Observation:** `make check-api` was run as part of Wave 1. The log shows: OpenAPI exported successfully → `orval` regenerated `generated.ts` → `git diff --exit-code frontend/src/api/generated.ts frontend/openapi.json` produced no output (exit 0). The frontend API client is fully in sync with the backend at audit time.
- **Impact:** No action needed. This is a positive signal for submission readiness.
- **Recommendation:** Maintain the `make check-api` gate in CI to catch any future drift before merge.
- **Effort:** S (already done)

---

### F-10-009 : No participant journey tutorial exists (participant perspective absent from docs)

- **Severity:** minor
- **Audience:** [SoftwareX] [Maintenance]
- **Location:** `docs/tutorials/`
- **Observation:** The four tutorials cover: admin study creation (your-first-study.md), admin recruitment (collecting-responses.md), admin analysis (analyzing-results.md), and developer local setup (local-development.md). There is no tutorial describing the **participant experience** end-to-end — from receiving a link to completing the Q-sort. The participant flow (rough sort → fine sort → post-sort) is described in `docs/explanation/q-methodology.md` at a conceptual level, but there is no step-by-step walkthrough of what a participant sees. SoftwareX reviewers often ask whether the software is usable by research participants with no technical background.
- **Impact:** Moderate: reviewers cannot easily verify the participant-facing UX from documentation alone. Also relevant for researchers who want to test the participant flow before deploying a real study.
- **Recommendation:** Add `docs/tutorials/participant-experience.md` — a short walkthrough (8–12 steps, with annotated screenshots or a Playwright-generated recording) of the participant journey from link receipt to submission confirmation. This doubles as a test case reference for axis 07 (UX).
- **Effort:** M

---

### F-10-010 : docs/explanation/q-methodology.md presents classical Q only — no critical Q framing

- **Severity:** minor
- **Audience:** [SoftwareX] [Maintenance]
- **Location:** `docs/explanation/q-methodology.md`
- **Observation:** The Q-methodology explainer covers Q-sort mechanics, grid design, and Libre-Q study phases in a technically accurate but exclusively classical-Q framing (Watts & Stenner 2012, Brown 1993). No mention of critical Q-methodology (Sneegas 2020, Stainton Rogers 1997, Stenner 2011), nor of the epistemological debates around forced distribution, interpretive transparency, or researcher-participant power. The README comparison table and features list (manual flagging, centroid extraction option) implicitly support critical Q workflows, but this is not made explicit anywhere in `docs/`. Finding F-12-010 (axis 12) already flags the README angle; this is the documentation-layer extension: the main Q explainer doc also lacks critical Q framing.
- **Impact:** Researchers coming from a critical Q background will not find the documentation reassuring that Libre-Q is designed with their epistemological commitments in mind. This is a missed opportunity to differentiate Libre-Q from classical-Q-only tools (PQMethod). For SoftwareX, the manuscript already addresses this (per article draft context), but the docs/ directory — which is what a reviewer will read first — does not reflect it.
- **Recommendation:** Add a subsection `## Critical Q-Methodology` to `docs/explanation/q-methodology.md` covering: (1) the interpretive tradition (Stainton Rogers 1997, Stenner 2011); (2) how Libre-Q's manual flagging and rotation options support researcher transparency; (3) pointer to the concourse management features. 1–2 paragraphs with 2–3 citations is sufficient. See F-12-010 for the README-level finding.
- **Effort:** S

---

### F-10-011 : docs/reference/api.md is manually maintained and likely to drift from actual API

- **Severity:** minor
- **Audience:** [Maintenance] [SoftwareX]
- **Location:** `docs/reference/api.md`
- **Observation:** The API reference is a handwritten Markdown file (~330 lines) covering endpoints, auth, rate limits, error formats, and security headers. It is accurate at time of audit (the OpenAPI client is in sync per F-10-008), but it is a *separate artifact* from the machine-generated `openapi.json` and the auto-generated TypeScript client. Unlike the TypeScript client, this Markdown file has no CI gate to detect drift. Notable gaps: the `concourse` endpoints (present in `routers/admin/concourses.py`) are not documented here; the `analysis/run` endpoint response schema is described in prose but not linked to the generated OpenAPI spec.
- **Impact:** If the backend API evolves (new endpoints, changed response shapes), `api.md` will silently fall behind, misleading external developers or SoftwareX reviewers who read the reference docs. The concourse endpoints gap means a non-trivial feature surface is undocumented.
- **Recommendation:** (1) Add a note at the top of `api.md` pointing to the live Swagger UI (`/docs`) as the authoritative reference. (2) Add a CI check (`grep -q "concourses" docs/reference/api.md || exit 1`) or equivalent to detect when new router files appear without corresponding doc entries. (3) Document the concourse endpoints (at minimum the list/create/update/delete pattern). Short-term: the redirect to `/docs` is sufficient for submission.
- **Effort:** S (note) + M (full concourse docs)

---

### F-10-012 : docs/contributing/ contains agent-only document exposed as contributor documentation

- **Severity:** observation
- **Audience:** [Maintenance]
- **Location:** `docs/contributing/agent-instructions.md`, `docs/contributing/prompting-strategy.md`
- **Observation:** Both `agent-instructions.md` and `prompting-strategy.md` are detailed guides for AI coding agents rather than human contributors. They are listed in `docs/README.md` alongside `coding-standards.md`, `backend-guidelines.md`, and `frontend-guidelines.md` — creating a mixed audience in the contributor documentation index. A human contributor reading the index encounters "AI Agent Instructions" and "Prompting Strategy" without context that these are agent-facing, not human-facing.
- **Impact:** Minor confusion for human contributors and reviewers browsing the docs. No functional impact.
- **Recommendation:** Add a brief note in `docs/README.md` distinguishing human-facing contributor docs from AI-agent-facing docs, or move the agent/prompting docs to a subfolder `docs/contributing/agents/`. Low priority.
- **Effort:** S

---

## Cross-References to Other Axes

| Finding | Cross-reference |
|---------|----------------|
| F-10-005 | F-09-005 (reproducibility axis — CLAUDE.md migration chain staleness is the primary finding there) |
| F-10-010 | F-12-010 (SoftwareX axis — critical Q absent from README; this extends to docs/explanation/) |
| F-10-004 | F-12 blockers (Zenodo DOI and version tag — blockers in submission package axis) |
| F-10-003 | F-12 compliance checklist (citation in README is a SoftwareX compliance item) |
| F-10-001 | F-12 package readiness (Statement of Need is a SoftwareX compliance item) |

---

## Checklist

| Check | Result |
|-------|--------|
| README — Statement of Need | MISSING (F-10-001) |
| README — Installation | Present (`## Quick Start`) |
| README — Usage example | Present (Quick Start + feature descriptions) |
| README — Software description / architecture | Present (`## Tech Stack`) |
| README — Contribution guide pointer | Present (`## Contributing`) |
| README — Citation | MISSING (F-10-003) |
| README — License | Present (`## License`) |
| README — Acknowledgments | MISSING (F-10-002) |
| README — Comparison with alternatives | Present (comparison table, but no prose) |
| CITATION.cff valid | Yes (schema 1.2.0) |
| CITATION.cff — ORCID present | No (both authors, F-10-004) |
| CITATION.cff — Zenodo DOI | No (F-10-004) |
| LICENSE — present, AGPL v3, intact | Yes |
| Docstring coverage overall | 81% (gate: 80%) — PASS |
| Docstring coverage services | 74% avg; 2 below 60% (F-10-007) |
| Broken links | 2 errors — same phantom `schemas.py` (F-10-006) |
| OpenAPI generated client in sync | YES — clean diff |
| Tutorials — admin study setup | Present |
| Tutorials — participant flow | MISSING (F-10-009) |
| Critical Q framing in docs/ | ABSENT from q-methodology.md (F-10-010) |
