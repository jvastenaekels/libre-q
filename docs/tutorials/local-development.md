# Local Development Setup

In this tutorial, you will set up a local development environment for Qualis, run both the backend and frontend, and make a small code change to verify everything works.

**What you will learn:**

- How to clone the repository and install all dependencies
- How to set up and configure PostgreSQL
- How to run database migrations
- How to start the backend and frontend development servers
- How to run linting, type checking, and tests

**Time required:** ~20 minutes

**Prerequisites:** Git, Python 3.13+, Node.js 24+, PostgreSQL 15+, and a Unix-like environment (Linux, macOS, or WSL).

If PostgreSQL is not yet installed:

- **macOS:** `brew install postgresql@15 && brew services start postgresql@15`
- **Debian/Ubuntu:** `sudo apt install postgresql-15 && sudo service postgresql start`
- **Windows:** Use [Postgres.app](https://postgresapp.com/) under WSL, or the [official installer](https://www.postgresql.org/download/windows/).

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/jvastenaekels/qualis.git
cd qualis
```

The repository is a monorepo:

```
qualis/
  backend/        # FastAPI application (Python)
  frontend/       # React SPA (TypeScript)
  docs/           # Documentation
  Makefile        # Common commands
```

---

## Step 2: Install Dependencies

Qualis uses `uv` for Python and `npm` for Node.js. A single Make command installs everything:

```bash
make install
```

This runs:
- `cd backend && uv sync` -- installs Python dependencies into `.venv/`
- `cd frontend && npm install` -- installs Node.js dependencies

If you do not have `uv` installed:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

---

## Step 3: Set Up PostgreSQL

Create a database for local development:

```bash
psql -U postgres

# In the psql shell:
CREATE DATABASE qualis_dev;
CREATE USER qualis_user WITH PASSWORD 'qualis_pass';
GRANT ALL PRIVILEGES ON DATABASE qualis_dev TO qualis_user;
\q
```

---

## Step 4: Configure Environment Variables

Copy the example file and edit it:

```bash
cp .env.example .env
```

The relevant variables to set for local development are:

```bash
DATABASE_URL=postgresql+asyncpg://qualis_user:qualis_pass@localhost:5432/qualis_dev
SECRET_KEY=your-secret-key-for-development-only
ACCESS_TOKEN_EXPIRE_MINUTES=60
FRONTEND_URL=http://localhost:5173
```

Generate a random secret key:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## Step 5: Run Database Migrations

```bash
make migrate
```

This runs Alembic migrations to create all necessary tables.

---

## Step 6: Start the Backend

```bash
make run-backend
```

This starts FastAPI at **http://localhost:8000** with hot-reload. Verify by visiting **http://localhost:8000/docs** (Swagger UI).

---

## Step 7: Start the Frontend

In a second terminal:

```bash
make run-frontend
```

This starts Vite at **http://localhost:5173** with HMR. Open it in your browser.

---

## Step 8: Create the First Admin Account

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, then bootstrap the user from the repository root:

```bash
cd backend && uv run python init_db.py && cd ..
```

Log in at **http://localhost:5173/login**. You should land in the admin dashboard.

---

## Step 9: Make a First Code Change

To verify the dev loop end to end, edit a visible string and watch HMR update the browser:

1. Open `frontend/src/pages/admin/DashboardPage.tsx` (or any page you can see in the browser).
2. Change a heading or label.
3. Save. The browser updates without a reload.
4. Revert the change.

If you do not see the update, check the Vite terminal for HMR errors.

---

## Step 10: Run the Quality Checks

### Run Everything (Recommended Before Pushing)

```bash
make ci
```

This runs in order:
1. **Linting** -- Ruff (Python), Biome (TypeScript/React)
2. **Type and Security Checks** -- mypy, bandit, radon, deptry, vulture, TypeScript, i18n key parity
3. **Tests** -- pytest (backend), Vitest (frontend)
4. **Build** -- production build of the frontend

### Run Individual Steps

```bash
make lint           # Linting only
make check          # Type checking and security analysis
make test           # Tests only
make e2e            # End-to-end tests (Playwright)
make build          # Frontend build only
```

### Fix Formatting

```bash
# Python
cd backend && uv run ruff format app/

# TypeScript/React
cd frontend && npm run lint:fix
```

---

## Step 11: Understand the Key Files

### Backend

| Path | Description |
|------|-------------|
| `app/main.py` | FastAPI application entry point |
| `app/models/` | SQLAlchemy models, one module per subdomain (user, project, study, participant, recruitment, concourse, analysis) |
| `app/schemas/` | Pydantic request/response models, one module per subdomain |
| `app/routers/` | API route handlers |
| `app/routers/admin/` | Admin API routes (studies, projects, exports, analysis) |
| `app/services/` | Business logic services |
| `app/core/config.py` | Application configuration |
| `alembic/` | Database migration scripts |
| `tests/` | pytest test suite |

### Frontend

| Path | Description |
|------|-------------|
| `src/pages/` | Page-level components (one per route) |
| `src/pages/admin/` | Researcher dashboard pages |
| `src/components/admin/` | Reusable admin UI components |
| `src/components/admin/analysis/` | Analysis result visualizations |
| `src/store/` | Zustand state management stores |
| `src/api/` | Generated API client (Orval) |
| `public/locales/` | i18n translation files (en, fr, fi) |

---

## Step 12: Regenerate the API Client

If you modify backend schemas or routes:

```bash
make generate-api
```

Always run `make check-api` before committing to ensure the client matches the backend.

---

## Common Troubleshooting

**"Database connection refused"**: Verify PostgreSQL is running and `DATABASE_URL` in `.env` is correct.

**"Module not found" in Python**: Use the virtual environment via `uv run`.

**Frontend build errors after pulling**: Clear and reinstall: `cd frontend && rm -rf node_modules && npm install`.

**Migration errors**: Reset the database with `make db-reset` (destroys all local data).

---

## What You Built

You now have a fully functional local development environment with:
- A running FastAPI backend with hot-reload
- A running React frontend with HMR
- A PostgreSQL database with the complete schema
- Knowledge of the CI pipeline and project structure

## Next Steps

- Read the [Architecture Overview](../explanation/architecture.md) to understand how the pieces fit together.
- Pick an issue from the GitHub repository and make your first contribution.
- Run `make ci` before every push.
