# Development Workflow

Daily-use commands and tooling for working on Qualis. For first-time setup (clone, install, database, running the dev servers), follow the [Local Development tutorial](../../tutorials/local-development.md). This guide assumes the tutorial has been completed once.

## Pre-commit hooks

Install the hooks so lint, types, and complexity checks run before every commit:

```bash
pre-commit install

# Optional: run on the whole repo
pre-commit run --all-files
```

## Make targets

| Scope | Command | Purpose |
| ----- | ------- | ------- |
| All | `make install` | Install Python (`uv sync`) and Node (`npm install`) dependencies. |
| All | `make lint` | Ruff + Biome. |
| All | `make check` | Type checks (mypy, tsc), security (bandit), dead-code (vulture, deptry), API sync, i18n parity. |
| All | `make test` | pytest + Vitest. |
| Inner loop | `make ci-fast` | Lint + types + unit tests (~30–90 s). Use between every change. |
| Pre-push | `make ci` | Full local CI (lint + check + test + build, ~3–5 min). |
| Full | `make ci-full` | `make ci` + DB reset + Playwright E2E (~10–15 min). |
| API | `make generate-api` | Regenerate the frontend OpenAPI client. |
| API | `make check-api` | Verify the committed client matches the backend. |
| E2E | `make e2e` | Playwright tests only. |

## API client synchronisation

Any change to backend routes or Pydantic schemas requires a client regeneration:

1. Run `make generate-api`.
2. Commit the updated `frontend/src/api/generated.ts`.
3. CI runs `make check-api` and fails if the client is out of sync.

## Architecture checks

Two fitness functions run via `make check`:

- **Backend** — `import-linter` enforces `routers` → `services` → `schemas` → `models`.
- **Frontend** — `dependency-cruiser` rejects circular dependencies and orphan files.

## Database maintenance

| Command | Purpose |
| ------- | ------- |
| `make migrate` | Apply pending Alembic migrations (`alembic upgrade head`). |
| `make migration-new` | Generate a new revision after editing models. **Always review** — auto-generation against an out-of-sync DB will include unrelated tables. |
| `make db-reset` | Drop and recreate all tables. **Destroys local data.** |
| `cd backend && uv run python seed.py data/example-study.json` | Update or create a study from a JSON definition. Backend must be running. |

For the migration chain and conventions, see the "Database Migrations" section in [`CLAUDE.md`](../../../CLAUDE.md).
