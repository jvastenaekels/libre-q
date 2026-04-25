# Libre-Q

Open-source platform for conducting Q-methodology research. Monorepo with a FastAPI backend and React frontend.

## Tech Stack

- **Backend:** Python 3.13, FastAPI, SQLAlchemy (async), PostgreSQL, Alembic, Pydantic
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Radix UI, dnd-kit, react-hook-form, Zustand, react-i18next
- **Tooling:** uv (Python), npm (Node 24), Biome (lint/format), Ruff (Python lint/format), Vitest, Playwright

## Project Structure

```
backend/        # FastAPI app
  app/          # Application code (models, schemas, services, routers)
  tests/        # Unit + integration tests (pytest)
frontend/       # React SPA
  src/           # Components, pages, hooks, store, api
  public/locales/  # i18n translation files (en, fr, fi)
```

## Key Commands (from project root)

```bash
make install          # Install all dependencies
make ci-fast          # Tight feedback loop: lint + types + unit tests (~30-90s)
make ci               # Full local CI: lint + check + test + build (run before pushing)
make lint             # Linting only (backend + frontend)
make check            # Type checking, security, dead code, API sync, i18n
make test             # Unit tests (backend + frontend)
make e2e              # End-to-end tests (Playwright)
make generate-api     # Regenerate frontend API client from OpenAPI spec
make migrate          # Run database migrations
make migration-new    # Create a new Alembic migration
```

**Inner-loop discipline:** `make ci-fast` between every change (~38s wall-clock).
`make ci` before push (~3-5min). E2E only when touching admin-flow code.

## Python environment rules
- This project uses a virtual environment strictly located in the `.venv` directory.
- Never use the global system Python.
- To execute code or install dependencies, always use explicit paths pointing to the virtual environment (for example: `.venv/bin/python` or `.venv/bin/pip`).

## Coding Standards

### General
- No `any` in TypeScript — use `unknown` or specific types. Use `// biome-ignore` only when truly necessary.
- No non-null assertions (`!`) — handle null values explicitly.
- Run `npm run lint:fix` (frontend) or `uv run ruff format` (backend) to auto-fix formatting.

### Strict-typed Python modules

The following backend modules are under `mypy --strict` (see `[[tool.mypy.overrides]]` in `backend/pyproject.toml`). When you add a new utility/leaf module, opt into the same bar by adding it to the overrides list:

**Full strict (disallow_any_explicit + disallow_untyped_defs + warn_return_any + strict_equality):**
- `app.utils.security`, `app.utils.audit`, `app.resume_codes`
- `app.exceptions`, `app.limiter`, `app.utils.crypto`, `app.utils.email`, `app.utils.script_utils`
- `app.services.storage_service` — boto3 stubs now ship; AudioUploadMetadata TypedDict eliminates Any
- `app.services.concourse_service` — ORM stub propagation resolved by models.py fix (wave 3b)
- `app.services.recruitment_service` — ORM stub propagation resolved by models.py fix (wave 3b)
- `app.services.analysis_service` — wave 3b: AnalysisRunResult, FactorCharacteristicDict, StatementClassEntry TypedDicts; wave 4: build_sort_matrix now typed SortDataDump|StudyDump → list[SortParticipantRecord], list[StatementDumpRecord]
- `app.services.study_defaults` — wave 3b post-mortem: TranslationDefaults TypedDict replaces dict[str, Any]
- `app.services.study_data_service` — wave 3b post-mortem: StudyDump, SortDataDump, StudyStats TypedDicts
- `app.services.export_service` — wave 3b post-mortem: _AudioMapEntry TypedDict; presort/postsort config helpers keep dict[str, Any] (type: ignore[explicit-any], open-ended schema)
- `app.types.wire`, `app.types` — new package: shared TypedDict wire shapes (Clusters 2-4)
- `app.routers.audio` — wave 4 batch 1: 3 return types added
- `app.routers.admin.recruitment` — wave 4 batch 1: List[T] → list[T], 3 return types
- `app.routers.admin.users` — wave 4 batch 1: cast(PaginatedResponse[UserRead], …) aligns mypy with FastAPI serialisation
- `app.routers.admin.analysis` — wave 4 batch 2: _get_analysis_dump returns SortDataDump; _get_statement_text typed StatementDumpRecord; typing.Any removed entirely

**Strict without disallow_any_explicit** (Pydantic/SQLAlchemy stubs or load-bearing Any at JSON boundaries):
- `app.core.config` — pydantic-settings BaseSettings stubs
- `app.middleware.security`, `app.middleware.errors`, `app.middleware.spa`
- `app.database`, `app.schema_validation`
- All `app.schemas.*` modules (10 modules) — Pydantic v2 BaseModel stubs
- `app.models` — remaining dict[str, Any] columns are load-bearing JSON blobs (presort_config, presort_answers, analysis result) at the ORM/JSON boundary
- `app.dependencies` — wave 4: Callable[…, Coroutine[Any,Any,T]] factory deps; Coroutine yield/send are always Any
- `app.routers.logs` — wave 4 batch 1: LogEntry.context is dict[str, Any] (open-ended frontend error data)
- `app.routers.admin.lifecycle` — wave 4 batch 1: Pydantic BaseModel classes in router (DataInventory etc.)
- `app.routers.admin.invitations` — wave 4 batch 1: InvitationAccept Pydantic model; get_db import corrected
- `app.routers.test` — wave 4 batch 1: 4 Pydantic model classes; 6 return types added

Total: 49 modules under strict overrides (Phase 3 wave 4 batches 1-2 complete).
Previous: 40 modules. Added 9: dependencies + 7 routers + analysis_service update.
Wave 4 highlights: build_sort_matrix cleanup eliminates last dict[str,Any] in analysis pipeline; security.py cast()s removed (bcrypt/jwt stubs now fully typed); analysis router promoted to full strict (had 31 errors — all annotation gaps).
Next wave: remaining routers (studies, projects, studies_import_export, auth, participants, submissions, concourses, exports, studies_participants); then heavy services (study_service, submission_service).

Inside a strict module: every function declares its return type, no implicit `Any` propagation, no untyped variables. Use `# type: ignore[explicit-any]` with a one-line rationale when `Any` is genuinely required (e.g. JWT wire payloads, httpx.Response.json() wire data).

### Internationalization
- All user-facing strings must use `useTranslation()` / `t()` with a key and English fallback: `t('key', 'Fallback')`
- Three locales: `en`, `fr`, `fi` — keep all translation files in sync
- Run `npm run i18n-check` to verify key parity

### Testing
- Backend: pytest with async fixtures. Mocks must include all methods used by the code under test.
- Frontend: Vitest with `renderWithStore` helper. Use `waitFor` for async state assertions.
- Use `make ci` as the quality gate — never push if it fails.

### Database Migrations (Alembic)
- Generate: `make migration-new` (auto-generates from model changes)
- **Always review generated migrations** — auto-generation against a blank or out-of-sync DB will include unrelated tables. The migration must only contain the intended schema change.
- Migrations run automatically on deploy via `Procfile` release phase (`python scripts/migrate.py`)
- Migration chain (15 migrations as of 2026-04-25, head `c94f0b41532e`):
  `initial_schema` → `rename_randomize_statements_to_randomize_statement_order`
  → `remove_consent_buttons` → `add_pre_instruction`
  → `add_is_test_run_to_participants` → `add_audio_recordings_table`
  → `add_display_order_to_statements`
  → `add_last_step_reached_to_participants` → `fix_last_step_reached_backfill`
  → `add_draft_responses_to_participants` → `add_resume_code_to_participants`
  → `add_concourse_tables` → `add_concourse_traceability_columns`
  → `add_item_versions_and_comments` → `rename_workspace_to_project`
  → `add_analysis_runs_table`
- Run `alembic history` (in `backend/`) for the canonical chain — this list will drift if not updated when new migrations are added.
- PostgreSQL DDL is transactional: a failed migration rolls back entirely, leaving `alembic_version` unchanged

### API Changes
- After modifying backend schemas/routes, run `make generate-api` to regenerate the frontend client
- Run `make check-api` to verify the generated client is committed and up to date
