# Axis 03 — Architecture

**Auditor:** Claude (standard pass)
**Date:** 2026-04-25
**Pass type:** Standard (automated + targeted manual review)
**Time budget:** 60 minutes

---

## Scope and method

1. **Backend layering** — traced request flow through router → service → model; grepped for direct model imports in routers and direct DB operations in routers.
2. **Service granularity** — read all 9 service files (analysis, concourse, export, recruitment, storage, study_data, study_defaults, study, submission); assessed single-responsibility.
3. **Schema coherence** — compared `models.py`, `backend/app/schemas/`, and `frontend/src/api/model/` for three core entities: Study, Statement, Participant/Submission.
4. **Frontend state** — walked all 7 Zustand store files; assessed per-domain isolation and cross-store coupling.
5. **Cross-cutting concerns** — checked error handling, logging, and transaction patterns.
6. **Import cycles** — manual AST-based graph traversal (no `pydeps` SVG available); confirmed no cycles at module load time.
7. **Frontend circular deps** — confirmed via `.raw/madge-circular.json`: empty array, 0 cycles.

---

## Summary

No import cycles, no god-object in the full sense. The overall architecture is sound and clearly intentional: FastAPI routers feed well-scoped services; Zustand stores are domain-isolated. The main findings cluster around **inconsistent service-layer adoption**: several routers bypass the service layer entirely for non-trivial business logic (auth, project CRUD, audio upload, study import validation), and a bidirectional dependency between `study_service` and `submission_service` is managed with a deferred-import workaround that masks a real coupling. None of these are blockers for deployment or submission, but the router-as-service pattern concentrates untestable business logic.

---

## Findings

### F-03-001 : Auth business logic lives entirely in the router

- **Severity:** major
- **Audience:** [Maintenance] [Prod]
- **Location:** `backend/app/routers/auth.py` (339 lines, 0 service imports, 12 direct DB operations)
- **Observation:** All authentication and account-management logic — user lookup, password verification, TOTP check, user creation, project membership assignment, email uniqueness, profile update, password change, TOTP setup/enable/disable — is implemented directly in `auth.py`. The file contains 8 endpoint functions totalling CC=12 direct DB operations with inline `db.add`, `db.flush`, `db.commit`, `db.rollback`. No `AuthService` or `UserService` exists. The only imports from the service layer are utility functions (`create_access_token`, `verify_password`, `get_password_hash`).
- **Impact:** All auth business logic is unreachable by unit tests without spinning up a full FastAPI request cycle. The auth path is also the highest-security surface in the application. Testing it requires integration test fixtures, not targeted unit tests. Cross-references: F-04-008 (coverage 13% on useAdminStore/useAuthStore traces back to this root cause on the backend). If an auth bug is introduced (e.g., TOTP bypass, email-uniqueness race), the test surface to catch it is minimal.
- **Recommendation:** Extract `UserService` (user CRUD, email check) and `AuthService` (token creation, TOTP flow) from `auth.py`. The router should only validate input and delegate. This enables unit-testing auth flows without HTTP.
- **Effort:** M

---

### F-03-002 : Project CRUD logic lives entirely in the router

- **Severity:** minor
- **Audience:** [Maintenance]
- **Location:** `backend/app/routers/admin/projects.py` (398 lines, 0 service imports, 20 direct DB operations)
- **Observation:** `projects.py` implements all project and membership business logic directly: project creation with slug uniqueness check, member listing with pagination, member update, member removal, project update, project deletion (with study count guard). All operations use raw `db.add`, `db.flush`, `db.commit`, `db.rollback` in the router body. No `ProjectService` is called.
- **Impact:** Project logic cannot be unit-tested without HTTP context. Lower severity than auth (F-03-001) because project management is lower-risk. However, the slug-uniqueness check, the "only delete when empty" guard, and member role enforcement are business rules that belong in a service.
- **Recommendation:** Extract `ProjectService` with `create_project`, `update_project`, `delete_project`, `manage_member` methods. The router becomes a thin adapter.
- **Effort:** M

---

### F-03-003 : `studies_import_export.py` contains CC=58 validation function in the router

- **Severity:** minor
- **Audience:** [Maintenance] [SoftwareX]
- **Location:** `backend/app/routers/admin/studies_import_export.py:200` — `validate_study_import` (CC=58, the highest cyclomatic complexity in the entire codebase)
- **Observation:** `validate_study_import` is a router-bound `async def` with 58 cyclomatic paths. It validates imported study JSON (version, structure, translations, statements, grid config, consent fields, recruitment links) by building `errors`/`warnings` lists inline. It also includes the study-creation endpoint at lines 400–499 with 11 direct DB operations (full `Study`, `StudyTranslation`, `Statement`, `StatementTranslation`, `RecruitmentLink` construction). This duplicates creation logic already present in `StudyService.create_study`.
- **Impact:** Duplicated creation logic means bug fixes to the creation path (e.g., handling new Study model fields) must be applied in two places. CC=58 is untestable at the unit level without HTTP infrastructure. This is the highest complexity function in the codebase.
- **Recommendation:** (1) Move `validate_study_import` logic to a `StudyImportService.validate_config` static method — pure function, easily unit-tested. (2) Route study import creation through `StudyService.create_study` to eliminate duplication.
- **Effort:** M

---

### F-03-004 : `audio.py` router contains full audio-upload business logic (CC=17)

- **Severity:** minor
- **Audience:** [Maintenance]
- **Location:** `backend/app/routers/audio.py:91` — `upload_audio` (CC=17, 9 direct DB operations in router)
- **Observation:** `upload_audio` implements quota computation, existing-recording detection and replacement, S3 upload, DB record creation, and rollback on commit failure — all inside the router function. Two helper functions (`validate_audio_file`, `check_storage_quota`) are also defined in the router file with their own DB access. The only service used is `storage_service` for the S3 call itself.
- **Impact:** Audio upload logic (quota, replacement, MIME type check) cannot be unit-tested without the full FastAPI HTTP cycle. Positive: the S3/DB rollback pattern is correctly implemented (S3 upload → DB commit → if DB fails, delete S3 object). No data integrity risk, only testability debt.
- **Recommendation:** Extract `AudioService` with `upload_audio` and `delete_audio` methods. `check_storage_quota` becomes a testable static method.
- **Effort:** S

---

### F-03-005 : Latent bidirectional coupling between `study_service` and `submission_service`

- **Severity:** minor
- **Audience:** [Maintenance]
- **Location:** `backend/app/services/submission_service.py:27` (module-level import); `backend/app/services/study_service.py:699–743` (deferred imports inside method bodies)
- **Observation:** `submission_service` imports `StudyService` at module load time (line 27: `from .study_service import StudyService`). `study_service` in turn imports `SubmissionService` lazily inside each backward-compat delegate method body (lines 699, 705, 711). This is a managed circular dependency: Python's deferred import resolves it at runtime, but the logical coupling is bidirectional. The comment in `study_service.py` acknowledges the pattern ("backward-compatible delegates"). No import cycle at load time was detected by AST traversal.
- **Impact:** The pattern is deliberate and functional. Risk: a developer moving code between these modules may inadvertently create a true import cycle (moving a lazy import to module scope). The backward-compat delegates on `StudyService` (8 forwarding stubs) also mean `StudyService` has a broader API surface than its documented responsibility ("core study operations: lookup, translation resolution, config, validation").
- **Recommendation:** Document the dependency direction explicitly in both files. In the medium term, callers of the legacy delegates should be updated to import directly from `submission_service` or `study_data_service`, allowing the 8 stubs to be removed.
- **Effort:** S (documentation) / M (full cleanup)

---

### F-03-006 : `invitations.py` router handles project membership business logic directly

- **Severity:** minor
- **Audience:** [Maintenance]
- **Location:** `backend/app/routers/admin/invitations.py:50–104`
- **Observation:** `accept_invitation` in the router directly creates `ProjectMember` objects, queries for duplicates, and commits — all without delegating to `ProjectService` (which does not exist) or `ConcourseService`. Token decoding is delegated to `utils.security`, but membership logic is inline.
- **Impact:** Minor because the endpoint is simple (50 lines) and the risk surface is low. However, invitation acceptance is a trust boundary (mapping token claims to DB membership), and keeping it in the router makes it harder to test the membership outcome independently.
- **Recommendation:** If `ProjectService` is created (F-03-002), fold invitation acceptance into it. Otherwise, at minimum extract a `process_invitation_acceptance(db, user, payload)` function.
- **Effort:** S

---

### F-03-007 : `useStudyDesigner` carries 15 `biome-ignore` suppressions and 2 stale `as any` casts for fields now present in generated types

- **Severity:** observation
- **Audience:** [Maintenance]
- **Location:** `frontend/src/store/useStudyDesigner.ts:70–73` (stale casts); lines 24, 35, 89, 95, 116, 164, 169, 182, 208, 221, 296, 316, 335 (all `biome-ignore`)
- **Observation:** Lines 70–73 cast `methodology_tips` and `step_help` as `any` with comments "methodology tips missing in generated type" / "step help missing in generated type". Both fields are present in `StudyTranslationRead` (line 40–41 of `studyTranslationRead.ts`) and `StudyTranslationCreate`. The comment is stale — the fields were added to the generated type but the workaround was not removed. The broader issue is that `updateTranslation` is typed `(lang: string, fn: (t: any) => void) => void`, losing all type safety on translation mutation.
- **Impact:** Stale `as any` casts erode `noExplicitAny` discipline and may mask future regressions if the field types change in the generated schema. The 15 total suppressions indicate that `useStudyDesigner` is under type pressure from JSON config fields (`presort_config`, `postsort_config`) being typed as `dict[str, Any]` in the Pydantic schema, which propagates to opaque TS types. Not a runtime bug.
- **Recommendation:** (1) Remove the two stale `as any` casts for `methodology_tips` and `step_help` (the types are already there). (2) Type `updateTranslation` with `StudyTranslationCreate` instead of `any`. (3) Consider defining stricter Pydantic models for `presort_config` and `postsort_config` (currently `dict[str, Any]`) to reduce downstream type pressure — this is a larger effort but would eliminate most remaining suppressions.
- **Effort:** S (stale casts) / L (full JSON config typing)

---

### F-03-008 : `useResponseStore` couples to two sibling stores at call time (cross-store side effects)

- **Severity:** observation
- **Audience:** [Maintenance]
- **Location:** `frontend/src/store/useResponseStore.ts:4–5, 83–88, 102–104`
- **Observation:** `useResponseStore` directly calls `useSessionStore.getState().setSaving(true/false)` (lines 83–88, saving indicator) and `useConfigStore.getState().config` (line 102, grid column capacity check). These are direct peer-store calls inside Zustand action bodies, creating implicit dependencies: `useResponseStore` cannot be instantiated or tested without `useSessionStore` and `useConfigStore` being initialized.
- **Impact:** Minor coupling in a well-isolated domain (participant Q-sort flow). `madge-circular.json` confirms no circular import. The pattern is idiomatic Zustand (`.getState()` for cross-store reads is the documented approach). Risk: if `useConfigStore` or `useSessionStore` are refactored, `useResponseStore` breaks silently.
- **Recommendation:** Document the dependency direction in the store file header. If `useResponseStore` tests are added (currently at low coverage per F-04-008 context), mock `useConfigStore.getState()` and `useSessionStore.getState()`.
- **Effort:** S

---

### F-03-009 : `users.py` admin router implements user CRUD inline without service layer

- **Severity:** observation
- **Audience:** [Maintenance]
- **Location:** `backend/app/routers/admin/users.py` (89 lines, 0 service imports, 8 direct DB operations)
- **Observation:** The superuser user management router (`list_users`, `create_user`, `delete_user`) performs all DB operations inline. While the file is small (89 lines), the user creation endpoint duplicates email uniqueness logic already present in `auth.py`'s `register_user`.
- **Impact:** Duplicated email check (present in both `auth.py` and `users.py`). If a superuser creates a user with a duplicate email the error comes from the DB constraint, not an early validation. Low severity because this path is superuser-only and rarely exercised.
- **Recommendation:** Consolidate into `UserService.create_user` once F-03-001 is resolved. No standalone action required.
- **Effort:** S (as part of F-03-001)

---

## Architecture strengths (for reference)

- **No import cycles** — AST traversal of 30+ backend modules finds zero cycles. Deferred imports in `study_service.py` are explicitly managed.
- **No frontend circular dependencies** — `madge-circular.json` confirms 0 cycles across the full frontend module graph.
- **Service layer is well-used for the core domain** — `concourses.py`, `submissions.py`, `studies.py`, `participants.py` all delegate to dedicated services. The service pattern is established and consistent for the primary study flow.
- **Zustand stores are domain-isolated** — 7 stores, each with a clear domain: auth, admin UI state, study design, participant config, participant response, session, UI transients. No single monolithic store.
- **Error handling is centralized** — `middleware/errors.py` provides a single `StandardError` schema and five exception handlers covering all error categories. Service exceptions (`NotFoundError`, `ValidationError`, `ConflictError`) are mapped to HTTP status codes in one place.
- **Transaction discipline** — Services and the few routers that directly commit to the DB generally use explicit `rollback()` on failure. The S3/DB atomicity in `audio.py` (upload → commit → rollback S3 on DB failure) is correctly implemented.
- **analysis_service is a pure function module** — 790 lines of stateless, dependency-free numerical functions (`build_sort_matrix`, `run_analysis`, etc.). No DB access, no ORM imports. Ideal testability profile.

---

## Cross-references

- **F-03-001 ↔ F-04-008** (useAdminStore/useAuthStore at 13% coverage — root cause is the untestable auth business logic in the router)
- **F-03-003** (studies_import_export CC=58 validation in router) — if axis 04 finds this function without coverage, the root cause is here
- **F-06-001** (no AnalysisRun model) — the analysis router in `admin/analysis.py` returns results directly without persistence; this is an architectural choice noted in axis 06, not duplicated here
