# Database Migration System

This directory contains database migration scripts to keep the schema in sync with application models.

## Quick Start

### Local Development

```bash
# Run all migrations
uv run python backend/scripts/migrate.py
```

### Production (Scalingo)

Migrations run automatically on every deployment via the `postdeploy` hook in the `Procfile`.

## Migration Scripts

### `migrate.py` - Consolidated Migration Runner

The main entry point that runs all migrations in the correct order. This script is:

- **Idempotent**: Safe to run multiple times
- **Self-checking**: Verifies table existence before attempting migrations
- **Verbose**: Provides clear logging of what's being changed

### Individual Migration Scripts

- `migrate_missing_columns.py` - Adds `randomize_statements`, `show_statement_codes`, `ui_labels`
- `migrate_participants.py` - Adds `random_seed` column to participants table
- `migrate_branding.py` - Adds branding-related columns
- `migrate_ui_labels.py` - Migrates UI label data

## Schema Validation

The application now validates the database schema on startup (`app/schema_validation.py`). If the schema is out of sync, you'll see a clear error message with instructions to run migrations.

## Creating New Migrations

When you add new columns or tables to the models:

1. Add migration logic to `scripts/migrate.py` in the appropriate function
2. Test locally: `uv run python backend/scripts/migrate.py`
3. Commit and push - Scalingo will run migrations automatically via `postdeploy`

## Troubleshooting

### "Schema validation failed" on startup

```bash
# Run migrations
uv run python backend/scripts/migrate.py

# If that fails, check logs for specific missing tables/columns
```

### First-time database setup

```bash
# Initialize the database with all tables
uv run python backend/init_db.py
```

### Scalingo Deployment

Migrations run automatically during deployment. Check deployment logs:

```bash
scalingo --app your-app logs --lines 100 | grep -A 10 "postdeploy"
```

## Architecture Notes

- **Workspace Tables**: `workspaces`, `workspace_members`, `study_collaborators` must exist before other migrations
- **Column Migrations**: Applied after table verification
- **Postdeploy Hook**: Runs migrations + study sync in sequence on Scalingo
