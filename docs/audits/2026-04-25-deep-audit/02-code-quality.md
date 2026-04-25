# Axis 02 — Code Quality

**Pass:** light  
**Date:** 2026-04-25  
**Tools run:** ruff, mypy, tsc --strict (via `npm run type-check`), vulture, radon-cc, knip, manual grep  
**Budget used:** ~30 min

---

## Summary

Backend lint and type-checking are clean (ruff: 0 errors; mypy: 0 errors across 56 files). Frontend
TypeScript has 3 open compiler errors and 159 suppressed `noExplicitAny` violations in production
code — a systematic weak-typing pattern concentrated in the study designer subsystem. Cyclomatic
complexity hotspots are mostly essential (form validation, Q-sort submission), with the exception of
`generate_csv` (CC=39) which could be decomposed. Dead-code signal from knip and vulture is
negligible (2 issues, neither actionable).

---

## Findings

### F-02-001 : TypeScript compiler errors in production build

- **Severity:** minor
- **Audience:** [Maintenance]
- **Location:** `frontend/src/components/admin/AppSidebar.tsx:129,156`, `frontend/src/pages/admin/ProjectSettingsPage.tsx:360`
- **Observation:** `npm run type-check` exits with code 2 and 3 errors (`TS7006: Parameter 'w' implicitly has an 'any' type`) — all in `.map(w => w[0])` lambdas extracting initials from user names. These are trivial to fix but the build is formally broken under strict mode.
- **Impact:** CI runs `type-check`; failing it silently or being normalized away reduces confidence that the type gate is actually enforced. SoftwareX reviewers who clone and run `make check` will see a non-zero exit.
- **Recommendation:** Annotate the parameter: `.map((w: string) => w[0])` in the three affected lambdas.
- **Effort:** S

---

### F-02-002 : Pervasive `any` suppression in study designer and Zustand store

- **Severity:** minor
- **Audience:** [Maintenance]
- **Location:** `frontend/src/store/useStudyDesigner.ts` (15 suppressions), `frontend/src/components/admin/designer/InterfaceEditor.tsx` (18), `frontend/src/components/admin/designer/PostSortConfigEditor.tsx` (12), `frontend/src/components/admin/designer/QSortEditor.tsx` (11), `frontend/src/components/admin/designer/ProcessStepEditor.tsx` (10) — 159 `biome-ignore lint/suspicious/noExplicitAny` in total across production code
- **Observation:** `biome.json` configures `noExplicitAny` via `recommended: true` for `suspicious`, but 159 suppressions in non-test source files (20 files) effectively disable it in the study designer subsystem. The root cause is that `updateTranslation`'s callback parameter in `useStudyDesigner` is typed `(t: any) => void` — every downstream consumer inherits the escape hatch.
- **Impact:** The study designer is the most complex frontend subsystem. Untyped translation mutation callbacks mean refactors or schema changes can introduce silent type errors that CI will not catch. This is the main type-safety gap in the frontend.
- **Recommendation:** Define a `StudyTranslationDraft` interface (or derive it from `StudyTranslationRead`) and type `updateTranslation`'s callback as `(t: StudyTranslationDraft) => void`. The cascade effect should eliminate 80–100 of the 159 suppressions. Remaining cases (dynamic postsort/presort JSON) can use `Record<string, unknown>` instead of `any`.
- **Effort:** M

---

### F-02-003 : `process_submission` CC=50 — essential complexity but untested integration path

- **Severity:** minor
- **Audience:** [Maintenance] [Prod]
- **Location:** `backend/app/services/submission_service.py:215`
- **Observation:** `process_submission` has CC=50 (radon). Manual review confirms the complexity is mostly essential: IP hashing, study state checks, date-based closure, recruitment link validation, statement ownership, distribution validation, presort/postsort branching, is_test_run flag, deduplication against existing participants. There are 3 unit tests (`test_process_submission_new_participant`, `test_process_submission_update_existing`, `test_process_submission_completed_early_return`) and 1 integration test for the happy path, but several branches (date-based closure, is_test_run path, link_token validation, edge-case deduplication) are untested (see also F-04 axis for coverage details).
- **Impact:** The most complex function on the critical participant path has coverage gaps. A regression in any untested branch (e.g. date-based closure) would only surface in production.
- **Recommendation:** Add unit tests for: date-based closure (study open vs. past `end_date`), `is_test_run=True` bypass, invalid `link_token`, empty `valid_statement_ids`. No structural refactor needed — the complexity is justified.
- **Effort:** M

---

### F-02-004 : `generate_csv` CC=39 — accidental complexity from format detection

- **Severity:** minor
- **Audience:** [Maintenance]
- **Location:** `backend/app/services/export_service.py:20`
- **Observation:** `generate_csv` (CC=39) contains two nested helper functions (`get_label`, `get_value_label`) and repeated format-detection logic (`if "fields" in config: … elif "enabled" not in config: …`) duplicated between presort and postsort resolution. This same pattern appears verbatim in `validate_for_activation` (CC=31). The complexity is partly accidental: the legacy config shape detection (string vs. dict, fields vs. enabled flag) is handled inline each time instead of through a shared resolver.
- **Impact:** Any change to the presort/postsort config schema requires updates in at least two places, risking divergence.
- **Recommendation:** Extract config resolution into a shared utility function `resolve_survey_config_fields(config: dict) -> dict` used by both `generate_csv` and `validate_for_activation`. This reduces each function's CC by ~8–10 and eliminates the duplication.
- **Effort:** S

---

### F-02-005 : `validate_for_activation` CC=31 — no dedicated unit tests

- **Severity:** minor
- **Audience:** [Maintenance] [SoftwareX]
- **Location:** `backend/app/services/study_service.py:536`
- **Observation:** `validate_for_activation` (CC=31) is the pre-activation gate that enforces scientific validity of a study configuration (presence of statements, grid, translations, per-language labels, statement text). It is tested only indirectly via 2 integration tests (`test_activate_study_only_french`, `test_activate_study_missing_default_fails`). Several branches — multilingual question label validation, missing presort/postsort option labels, empty statement text — have no test coverage.
- **Impact:** A regression in the activation gate could allow malformed studies into the active state, corrupting data collection or producing uninterpretable Q-sorts. For SoftwareX, the activation gate is a correctness claim that should be verifiable by reviewers.
- **Recommendation:** Add unit tests targeting `StudyService.validate_for_activation` directly: (a) study with missing postsort option label in one language, (b) statement with empty text, (c) fully valid multilingual study returning empty errors list.
- **Effort:** S

---

### F-02-006 : Dead type export `CardInfo` — observation only

- **Severity:** observation
- **Audience:** [Maintenance]
- **Location:** `frontend/src/store/useUIStore.ts:3`
- **Observation:** Knip reports `CardInfo` as an exported type that is not imported anywhere outside `useUIStore.ts`. The type is used internally by the store's state interface.
- **Impact:** Negligible — a minor noise export. No runtime effect.
- **Recommendation:** Change `export type CardInfo` to `type CardInfo` (unexported). Single-line fix.
- **Effort:** S

---

### F-02-007 : Backend dead code — vulture reports zero findings

- **Severity:** observation
- **Audience:** [Maintenance]
- **Location:** transverse (backend)
- **Observation:** `vulture backend/app backend/vulture_whitelist.py --min-confidence 60` produces no output — all named code paths are reachable or whitelisted. The whitelist is actively maintained.
- **Impact:** Positive signal. No action required.
- **Recommendation:** None.
- **Effort:** —

---

### F-02-008 : Backend lint clean — ruff and mypy both pass

- **Severity:** observation
- **Audience:** [SoftwareX] [Maintenance]
- **Location:** transverse (backend, 56 source files)
- **Observation:** `ruff check backend/app` exits 0 with "All checks passed!". `mypy backend/app` exits 0 with "Success: no issues found in 56 source files". The backend is statically sound under the configured rule set.
- **Impact:** Positive signal for SoftwareX reviewers running `make check`.
- **Recommendation:** None. Consider adding `--strict` to the mypy invocation in `Makefile` to catch implicit `Any` at the backend boundary (currently off).
- **Effort:** S

---

### F-02-009 : `useStudyDesigner.ts` `importConfig` typed as `any` — schema-level gap

- **Severity:** minor
- **Audience:** [Maintenance]
- **Location:** `frontend/src/store/useStudyDesigner.ts:36`
- **Observation:** `importConfig: (config: any) => void` accepts arbitrary JSON with no runtime validation. It is used when importing an existing study configuration into the designer. Downstream, `stripInternalFields(obj: any): any` recursively processes the config without type guards.
- **Impact:** An import of a malformed or incompatible study config (e.g., from a different Libre-Q version) produces no validation error in the designer, potentially corrupting the designer state silently.
- **Recommendation:** Type `importConfig`'s argument as `unknown` and validate it with the existing Zod schemas (`StudyUpdate`) or a dedicated `studyConfigSchema` before loading into the store. This converts a silent failure mode into an early, actionable error.
- **Effort:** S

---

### F-02-010 : `useExhaustiveDependencies` downgraded to `warn` in Biome — silent stale-closure risk

- **Severity:** observation
- **Audience:** [Maintenance]
- **Location:** `frontend/biome.json` — `"correctness": { "useExhaustiveDependencies": "warn" }`
- **Observation:** React hook dependency exhaustiveness is configured as a warning, not an error. grep on `.biome-ignore correctness/useExhaustiveDependencies` finds 10 suppressions in production files, meaning at least 10 hooks have manually excluded dependencies. This is a common source of stale-closure bugs.
- **Impact:** Low immediate risk (10 suppressions is not alarming), but the pattern can silently grow. Stale closures in Q-sort submission or analysis hooks would be hard to reproduce.
- **Recommendation:** Promote `useExhaustiveDependencies` to `"error"` and address or explicitly justify each suppression. This is a low-effort one-time cleanup that prevents the suppression count from creeping up.
- **Effort:** S

---

## Complexity hotspot classification (top 5, excluding F-03 findings)

| Rank | Function | CC | File | Classification |
|------|----------|----|------|---------------|
| 1 | `validate_study_import` | 58 | `routers/admin/studies_import_export.py:200` | Essential — see F-03-003 |
| 2 | `process_submission` | 50 | `services/submission_service.py:215` | Mostly essential, coverage gap — F-02-003 |
| 3 | `get_resolved_study_config` | 39 | `services/study_service.py:400` | Essential (multilingual fallback logic) — tested |
| 4 | `generate_csv` | 39 | `services/export_service.py:20` | Partly accidental — F-02-004 |
| 5 | `validate_for_activation` | 31 | `services/study_service.py:536` | Essential, untested branches — F-02-005 |

Note: `upload_audio` (CC=17) is F-03-004; not duplicated here.
