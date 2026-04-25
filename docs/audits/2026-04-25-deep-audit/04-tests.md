# Axis 04 — Tests

**Date:** 2026-04-25  
**Auditor:** Claude (Sonnet 4.6) on behalf of J. Vastenaekels  
**Pass:** Deep  
**Raw inputs:** `pytest-coverage.xml`, `pytest-output.log`, `vitest-coverage/`, `vitest-output.log`, `mutmut-results.txt`

---

## Summary

| Metric | Value |
|--------|-------|
| Backend total coverage | 70% (3 260 / 4 665 lines) |
| Backend test count | 297 passed, 1 skipped |
| Frontend total coverage | 62% lines, 52% branches |
| Frontend unit test count | ~393 test cases across 71 files |
| E2E Playwright spec files | 10 (participant flow + admin) |
| Mutation score (`analysis_service.py`) | **Not available** — mutmut 3.5.0 failed to run (incompatibility with async pytest stack; documented in `.raw/mutmut-results.txt`) |

---

## Findings

### F-04-001 : `submission_service.py` concurrency paths (IntegrityError, ConcurrencyError) untested

- **Severity:** major
- **Audience:** [Prod] [Maintenance]
- **Location:** `backend/app/services/submission_service.py:99–112, 348–366`
- **Observation:** `submission_service.py` is at 65% line coverage. The 72 uncovered lines include all concurrency error-handling branches: the `IntegrityError` handler for concurrent consent creation (lines 106–112), the rollback-and-re-fetch path, the `ConcurrencyError` raise path for resume-code collisions (lines 99–105), and the parallel path for updating an existing participant's resume code (lines 127–141). Integration tests in `test_participation.py` exercise the happy path (`test_full_submission_flow`) and simple validation errors, but no test simulates a concurrent session or forces an `IntegrityError`. The `record_consent()` method is separately uncovered for the update-existing-participant branch (lines 115–141).
- **Impact:** The concurrency paths are exactly where subtle data corruption bugs hide in production (race conditions on `session_token`, double-consent, lost resume codes). If broken, a participant might receive no resume code or get a 500 error that is invisible in logs. For [Prod], the lack of test means a regression in the race handler would go undetected. For a [SoftwareX] audience scrutinizing test quality, this gap in a critical-path service is visible.
- **Recommendation:** Add at least one integration test that simulates concurrent consent recording by inserting a pre-existing participant with the same `session_token` before calling `record_consent()`, forcing the `IntegrityError` branch. Use `asyncio.gather()` or database fixture manipulation. Test the resume-code collision path by mocking `generate_unique_resume_code` to raise `IntegrityError` twice then succeed.
- **Effort:** M

---

### F-04-002 : `study_service.py` at 52% — create/update/delete flows untested at service layer

- **Severity:** major
- **Audience:** [Prod] [Maintenance]
- **Location:** `backend/app/services/study_service.py` (157 uncovered lines out of 325)
- **Observation:** `study_service.py` is the central service for study lifecycle management, yet only 52% of its lines are exercised. Inspection of coverage data shows that lines 84–131 (study creation with translations, branding, start/end dates) are entirely uncovered at the service layer. The integration tests in `test_studies.py` exercise the HTTP layer and hit these paths, but the unit test file (`test_study_service.py`, 284 lines) focuses narrowly on `validate_distribution` and `process_submission`. The study creation, update, and delete service methods have no direct unit-level tests. This means the service logic is only exercised indirectly through full HTTP stack, making it harder to isolate regressions.
- **Impact:** If a refactor of the translation-merge logic or the branding-field handling introduces a bug, it will only surface via an integration test failure — slower to diagnose and harder to fix precisely. For [Maintenance], the 52% gap signals that future contributors cannot safely change the service without running full integration tests.
- **Recommendation:** Add unit tests for `StudyService.create_study()` covering: creation with multiple translations, creation with branding, creation with start/end dates, conflict error on duplicate slug. These can use the existing async DB fixture and avoid mocking the unit under test.
- **Effort:** M

---

### F-04-003 : `storage_service.py` at 37% — S3 upload, delete, presigned-URL paths have no unit tests

- **Severity:** major
- **Audience:** [Prod] [Maintenance]
- **Location:** `backend/app/services/storage_service.py` (48 uncovered lines out of 76; lines 46, 57, 83–95, 110–113, 119–130)
- **Observation:** `StorageService` handles audio file upload, deletion, and presigned-URL generation against S3-compatible storage. The integration tests in `test_audio.py` correctly mock `app.routers.audio.storage_service` at the router level (appropriate — avoids real S3 calls) but this means the service's own logic is bypassed entirely. The uncovered lines include: the `upload_audio()` method body (boto3 call, error handling), `delete_audio()`, and `generate_presigned_url()`. The 37% coverage comes only from import-time execution and the `__init__` guard.
- **Impact:** The mock-at-router pattern is the right choice for integration testing, but it leaves the service's error-handling branches (S3 `ClientError` → `ServiceError`, `NotFoundError` raises) untested. A `ClientError` from a misconfigured bucket in prod would hit untested code paths. For [Prod], this is a gap in the audio feature path.
- **Recommendation:** Add a unit test file `tests/unit/test_storage_service.py` that creates a `StorageService(skip_init=True)` instance and mocks `self.s3_client` with a `MagicMock/AsyncMock`, testing the `ClientError` → `ServiceError` translation in `upload_audio()` and `delete_audio()`. This does not require real S3 and tests the actual service logic.
- **Effort:** S

---

### F-04-004 : `recruitment_service.py` at 54% — capacity enforcement and link-expiry paths untested

- **Severity:** minor
- **Audience:** [Prod]
- **Location:** `backend/app/services/recruitment_service.py:50–107` (34 uncovered lines)
- **Observation:** The uncovered lines include `get_study_links()`, `get_link_by_token()`, `delete_link()`, and critically `increment_usage()` (the atomic capacity check with `with_for_update()`). The existing `tests/integration/test_recruitment.py` tests link creation and validation at the HTTP layer but does not exercise the capacity-exhaustion path or the delete path. `increment_usage()` uses a row-level lock that is particularly important to test correctly.
- **Impact:** A regression in `increment_usage()` could allow more participants than the link's capacity. Given recruitment links are a documented feature (configurable capacity), this is a prod-safety gap even if not a data-corruption risk.
- **Recommendation:** Add integration tests for: a link at full capacity returning 403/rejection, concurrent usage increment (use two concurrent requests), and `delete_link()` cascade.
- **Effort:** S

---

### F-04-005 : `schema_validation.py` at 0% — startup schema validator entirely untested

- **Severity:** minor
- **Audience:** [Prod] [Maintenance]
- **Location:** `backend/app/schema_validation.py` (63 lines, 0% coverage)
- **Observation:** `schema_validation.py` validates the database schema at startup against the ORM models. It has 63 executable lines and zero coverage. The module is likely invoked at app startup (`lifespan`) but the test suite does not exercise it. A bug in the schema-validation logic would fail silently or produce a confusing startup error.
- **Impact:** If the validator incorrectly reports schema mismatch on a valid schema, it could block deployment. If it incorrectly passes an invalid schema, the safety net is lost. For [Prod], this is a gap in a safety mechanism.
- **Recommendation:** Add one unit test that mocks `inspect(engine)` to return a minimal valid schema and verifies `validate_schema()` completes without raising, plus one test where it detects a missing column.
- **Effort:** S

---

### F-04-006 : E2E suite has no test for admin analysis workflow (factor analysis, eigenvalues, export)

- **Severity:** major
- **Audience:** [SoftwareX] [Prod]
- **Location:** `frontend/e2e/` (transverse — no spec file covers admin analysis)
- **Observation:** Searching all 10 e2e spec files for "analysis", "eigenvalue", "factor" returns zero matches. The `admin-flow.spec.ts` "Zero to Hero" test exercises study creation, participant injection, and CSV export, but stops before running factor analysis. The `AnalysisPage.tsx` UI (which drives the core Q-methodology output) has no e2e test. The unit tests (`AnalysisPage.test.tsx`) mock the entire API layer, so no test verifies the full round-trip: running analysis via the backend, rendering factor arrays, displaying distinguishing statements, triggering the XLSX export.
- **Impact:** For [SoftwareX], the factor analysis workflow is the scientific differentiator of Libre-Q. An e2e test failure here would be the first thing a SoftwareX reviewer would notice when running the test suite. For [Prod], changes to the analysis API response shape or the `FactorArraysView` rendering could ship silently broken.
- **Recommendation:** Add an e2e spec `frontend/e2e/admin/analysis-flow.spec.ts` that: (1) creates and activates a study with sufficient participants, (2) navigates to the analysis page, (3) selects PCA + varimax + 2 factors, (4) asserts factor characteristics are rendered, (5) triggers XLSX export and verifies download. Use the existing `testDb` fixture pattern.
- **Effort:** M

---

### F-04-007 : `FactorArraysView.tsx` and `FactorCharacteristicsTable.tsx` have 0% test coverage

- **Severity:** major
- **Audience:** [SoftwareX] [Maintenance]
- **Location:** `frontend/src/components/admin/analysis/FactorArraysView.tsx`, `frontend/src/components/admin/analysis/FactorCharacteristicsTable.tsx`
- **Observation:** Both components are at 0% line coverage in vitest. These are the primary UI components that render the factor arrays and factor characteristics (eigenvalue, variance explained, composite reliability, SED) — the core scientific output of Libre-Q. Neither has a test file. The git status shows both files were recently modified (they appear as `M` in git status), meaning they may contain recent changes with no regression coverage.
- **Impact:** For [SoftwareX], these components are the visual interface that a reviewer would see when evaluating the software's scientific output. Rendering bugs (wrong column order, NaN display, missing distinguishing markers) would be invisible to CI. For [Maintenance], both files are active development targets without any test safety net.
- **Recommendation:** Add `FactorArraysView.test.tsx` and `FactorCharacteristicsTable.test.tsx` with mock `AnalysisResult` data (the test data structure already exists in `AnalysisPage.test.tsx` as `_mockResult`). Test: empty-flagged-participants renders the "no flagged participants" message; factor arrays display in correct column order; distinguishing statements are highlighted; table rows match factor_characteristics count.
- **Effort:** M

---

### F-04-008 : `useAdminStore.ts` and `useAuthStore.ts` at 13% — authentication state management virtually untested

- **Severity:** major
- **Audience:** [Prod] [Maintenance]
- **Location:** `frontend/src/store/useAdminStore.ts:23–46`, `frontend/src/store/useAuthStore.ts:35–62`
- **Observation:** The two Zustand stores managing authentication state and admin session state are at 13% line coverage each, with 0% branch coverage. Both stores contain action logic (login, logout, token refresh, project switching) that is exercised by the application but not by any unit test. The existing store tests (`atomicStores.test.ts`, `useConfigStore.test.ts`, `useResponseStore.test.ts`) demonstrate that store testing is established in the project — these two stores were simply not included.
- **Impact:** A regression in `useAuthStore` — such as failing to clear the token on logout, or not refreshing on expiry — would not be caught by CI. For [Prod], this is an auth correctness risk. The logout-not-clearing-token pattern is a common source of session vulnerabilities.
- **Recommendation:** Add `useAuthStore.test.ts` and `useAdminStore.test.ts` following the existing store test pattern. Test: initial state, login sets token and user, logout clears state, token expiry triggers refresh (or logout).
- **Effort:** S

---

### F-04-009 : `asyncio.sleep(1.1)` in concurrency test creates fragile, slow CI

- **Severity:** minor
- **Audience:** [Maintenance]
- **Location:** `backend/tests/integration/test_studies_concurrency.py:30`
- **Observation:** `test_update_study_optimistic_locking` uses `await asyncio.sleep(1.1)` to advance time before testing the optimistic-locking check. This adds at least 1.1 s per run unconditionally, and is fragile if the system under load takes longer to process the first update (making `last_updated_at` flicker). The underlying feature (optimistic lock check) depends on comparing timestamps, not on actual wall-clock time passage.
- **Impact:** For [Maintenance]: adds ~1.1 s to every CI run for a test that should be near-instantaneous. On slow CI it may be flaky. The comment adjacent to the sleep ("// DRAFT BEHAVIOR: Allow overwrite") reveals the test's assertion was already relaxed; the sleep may now be testing nothing meaningful.
- **Recommendation:** Replace the sleep with an explicit `db.refresh(seed_study)` + timestamp-manipulation fixture, or refactor to directly manipulate `updated_at` in the DB to test the comparison logic without real time passage.
- **Effort:** S

---

### F-04-010 : Two assertion-free tests in `test_scripts.py`

- **Severity:** minor
- **Audience:** [Maintenance]
- **Location:** `backend/tests/unit/test_scripts.py:31–49` (`test_run_task_success`), `backend/tests/unit/test_scripts.py:51–74` (`test_run_task_with_args`)
- **Observation:** Both `test_run_task_success` and `test_run_task_with_args` contain no `assert` statement. They verify only that the function "does not raise" — which is an implicit check but is easily missed. `test_run_task_with_args` writes a script that calls `sys.exit(1)` on wrong args, but this would cause `subprocess` to return a non-zero exit code; whether `run_task()` propagates this as an exception or swallows it is not verified by any assertion.
- **Impact:** For [Maintenance]: these tests pass trivially even if `run_task()` is changed to a no-op. A reviewer cannot tell what invariant they establish.
- **Recommendation:** Add `assert` statements that check the observable side-effect — e.g., verify that stdout contains "Hello from test script" by capturing the subprocess output, or verify that the function does not call `sys.exit()` by checking that no `SystemExit` is raised.
- **Effort:** S

---

### F-04-011 : `waitForTimeout(2000)` hardcoded delay in "Zero to Hero" e2e test

- **Severity:** minor
- **Audience:** [Maintenance]
- **Location:** `frontend/e2e/admin/admin-flow.spec.ts:118`
- **Observation:** `await page.waitForTimeout(2000)` is used to wait for a participant table to render after participant injection. This is a 2-second unconditional sleep, a known Playwright anti-pattern. The comment above it ("// Wait for table to render") indicates it was added as a workaround. Additional `waitForTimeout` instances exist at lines 158 and 185 of `state-management.spec.ts` (250 ms and 100 ms).
- **Impact:** For [Maintenance]: these sleeps make the e2e suite slower and flaky on under-resourced CI machines. A 2000 ms sleep before asserting table row count is the most egregious — if the backend is slow, the test can still fail; if fast, it wastes time.
- **Recommendation:** Replace `page.waitForTimeout(2000)` with `await expect(page.locator('tbody tr')).toHaveCount(1)` (Playwright's built-in retry logic will poll until the condition is met or the default timeout is reached). Similarly replace the shorter sleeps with appropriate `waitFor` selectors.
- **Effort:** S

---

### F-04-012 : Mutation testing unavailable — mutmut 3.x incompatible with async pytest stack

- **Severity:** observation
- **Audience:** [Maintenance]
- **Location:** transverse — `backend/pyproject.toml`, `.raw/mutmut-results.txt`
- **Observation:** mutmut 3.5.0 was installed and run against `analysis_service.py` using both Python 3.12 (audit venv) and Python 3.13 (project venv). Both attempts failed with `BadTestExecutionCommandsException` during the stats-collection phase. mutmut 3.x uses a trampoline-based instrumentation model that requires a first pass of the test suite under its own plugin before mutating; this phase fails with the project's `pytest-asyncio` fixtures and async SQLAlchemy session setup. The file was detected (`1 unmodified`) but `0 files mutated` — no mutation score was produced.
- **Impact:** No mutation score is available for `analysis_service.py`. The unit tests for this service look substantive (edge cases for centroid extraction, sign standardization, tie-handling, NaN propagation), but mutation testing would confirm whether they catch real logical bugs (e.g., off-by-one in SED computation, wrong `np.argsort` direction for tie resolution). The absence of a mutation score is not a blocker by itself, but it leaves the quality of the analysis test suite unconfirmed at the mutation level.
- **Recommendation:** Downgrade to `mutmut==2.4.4` (the last 2.x release) and add a `make mutation-test` target scoped to `analysis_service.py`. The 2.x API (`--paths-to-mutate`, `--runner`) is stable and not incompatible with async pytest. Alternatively, evaluate `pytest-mutagen` as a maintained alternative. Do not add mutmut to `pyproject.toml` permanently until the compatibility issue is resolved and the tool is validated.
- **Effort:** S

---

### F-04-013 : Admin analysis page unit tests mock the entire API — UI logic and interaction paths not exercised

- **Severity:** observation
- **Audience:** [Maintenance]
- **Location:** `frontend/src/pages/admin/AnalysisPage.test.tsx:14–33`
- **Observation:** `AnalysisPage.test.tsx` uses `vi.hoisted()` to mock both `useGetEigenvaluesApiAdminStudiesSlugAnalysisEigenvaluesGet` and `useRunFactorAnalysisApiAdminStudiesSlugAnalysisRunPost` — the two API hooks that drive the entire page. This is necessary for unit testing in isolation, but it means the 43% line coverage reflects that only loading, error, and basic-render states are tested. The interaction flows (selecting extraction method, changing factor count, submitting analysis, rendering full results with all sub-components) are not tested at the unit level. The missing 57% of lines (470–545 per coverage data) likely corresponds to result rendering paths.
- **Impact:** Not a blocker by itself — the interaction paths should be covered by e2e tests (but see F-04-006, which notes e2e is missing). The combination of incomplete unit tests (43%) and no e2e analysis tests creates a coverage void for the most visible feature of the application.
- **Recommendation:** Extend `AnalysisPage.test.tsx` with a test that mocks both hooks returning data, simulates the "Run Analysis" button click via `userEvent`, and asserts key rendered outputs (factor characteristics table, statement count, distinguishing statement markers). This is complementary to the e2e spec recommended in F-04-006.
- **Effort:** S

---

### F-04-014 : Frontend generated API model files at 0% — inflates "uncovered" count without meaningful risk

- **Severity:** observation
- **Audience:** [Maintenance]
- **Location:** `frontend/src/api/model/*.ts` (~200 files at 0% coverage)
- **Observation:** The vitest coverage summary includes approximately 200 auto-generated TypeScript model files (e.g., `analysisRequest.ts`, `studyRead.ts`, `participantDetailRead.ts`) at 0% line coverage. These files are generated by `make generate-api` from the OpenAPI spec and consist entirely of type definitions (`type X = {...}`). Type-only files produce zero runtime lines; their 0% coverage is a vitest reporting artifact, not a meaningful gap.
- **Impact:** These files inflate the count of "untested files" and suppress the apparent overall coverage percentage. If vitest's coverage threshold were enforced at the repo level, these files would trigger spurious failures.
- **Recommendation:** Exclude `frontend/src/api/model/` and `frontend/src/api/generated/` from the vitest coverage configuration (`coverage.exclude` in `vitest.config.ts`). This will raise the reported coverage percentage to reflect only hand-authored code and make coverage thresholds meaningful.
- **Effort:** S

---

## Cross-reference

- F-04-001 is related to F-01-* (consent flow security) — untested concurrency paths in `record_consent` have auth implications.  
- F-04-006 and F-04-007 are related — both concern the analysis UI; fixing one creates the fixture for the other.  
- F-04-012 (mutation testing) is a prerequisite for confirming the quality of `analysis_service.py` tests already flagged in the Q-methodology axis (see F-06-*).
