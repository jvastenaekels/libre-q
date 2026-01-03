"""Migration 002: Add Workspace Architecture Tables.

Adds tables for workspace-based organization:
- workspaces
- workspace_members
- study_collaborators
- workspace_id column on studies table

This migration is idempotent and can be re-run safely.
"""

import asyncio
import os
import sys

# Add backend directory to path
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import text  # noqa: E402

from app.database import engine  # noqa: E402


async def migrate():
    """Add workspace architecture tables if they don't exist."""
    print("--- Migration 002: Workspace Architecture ---")

    async with engine.begin() as conn:
        dialect = conn.dialect.name
        print(f"Database dialect: {dialect}")

        # Check which tables already exist
        if dialect == "postgresql":
            result = await conn.execute(
                text(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = 'public'"
                )
            )
            existing_tables = {row[0] for row in result.fetchall()}
        else:
            result = await conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            )
            existing_tables = {row[0] for row in result.fetchall()}

        print(f"Existing tables: {existing_tables}")

        # 1. Create workspaces table
        if "workspaces" not in existing_tables:
            print("Creating 'workspaces' table...")
            if dialect == "postgresql":
                await conn.execute(
                    text("""
                        CREATE TABLE workspaces (
                            id SERIAL PRIMARY KEY,
                            title VARCHAR NOT NULL,
                            slug VARCHAR UNIQUE NOT NULL,
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                        )
                    """)
                )
                await conn.execute(
                    text("CREATE INDEX ix_workspaces_slug ON workspaces(slug)")
                )
            else:
                await conn.execute(
                    text("""
                        CREATE TABLE workspaces (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            title VARCHAR NOT NULL,
                            slug VARCHAR UNIQUE NOT NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """)
                )
            print("✅ Created 'workspaces' table")
        else:
            print("⏭️  'workspaces' table already exists")

        # 2. Create workspace_members table
        if "workspace_members" not in existing_tables:
            print("Creating 'workspace_members' table...")
            await conn.execute(
                text("""
                    CREATE TABLE workspace_members (
                        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        role VARCHAR NOT NULL DEFAULT 'viewer',
                        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        PRIMARY KEY (workspace_id, user_id)
                    )
                """)
            )
            print("✅ Created 'workspace_members' table")
        else:
            print("⏭️  'workspace_members' table already exists")

        # 3. Create study_collaborators table
        if "study_collaborators" not in existing_tables:
            print("Creating 'study_collaborators' table...")
            await conn.execute(
                text("""
                    CREATE TABLE study_collaborators (
                        study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        role VARCHAR NOT NULL DEFAULT 'viewer',
                        added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        PRIMARY KEY (study_id, user_id)
                    )
                """)
            )
            print("✅ Created 'study_collaborators' table")
        else:
            print("⏭️  'study_collaborators' table already exists")

        # 4. Add workspace_id column to studies table if missing
        print("Checking 'studies.workspace_id' column...")
        if dialect == "postgresql":
            result = await conn.execute(
                text("""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = 'studies' AND column_name = 'workspace_id'
                """)
            )
            has_workspace_id = result.fetchone() is not None
        else:
            result = await conn.execute(text("PRAGMA table_info(studies)"))
            columns = [row[1] for row in result.fetchall()]
            has_workspace_id = "workspace_id" in columns

        if not has_workspace_id:
            print("Adding 'workspace_id' column to studies...")

            # First, ensure a default workspace exists
            result = await conn.execute(
                text("SELECT id FROM workspaces WHERE slug = 'default' LIMIT 1")
            )
            default_ws = result.fetchone()

            if not default_ws:
                print("Creating default workspace...")
                await conn.execute(
                    text(
                        "INSERT INTO workspaces (title, slug) VALUES ('Default Workspace', 'default')"
                    )
                )
                result = await conn.execute(
                    text("SELECT id FROM workspaces WHERE slug = 'default' LIMIT 1")
                )
                default_ws = result.fetchone()

            default_ws_id = default_ws[0]
            print(f"Default workspace ID: {default_ws_id}")

            # Add column (nullable first for existing data)
            if dialect == "postgresql":
                await conn.execute(
                    text("ALTER TABLE studies ADD COLUMN workspace_id INTEGER")
                )
                # Update existing studies to default workspace
                await conn.execute(
                    text(
                        f"UPDATE studies SET workspace_id = {default_ws_id} WHERE workspace_id IS NULL"
                    )
                )
                # Add NOT NULL constraint and FK
                await conn.execute(
                    text("ALTER TABLE studies ALTER COLUMN workspace_id SET NOT NULL")
                )
                await conn.execute(
                    text(
                        "ALTER TABLE studies ADD CONSTRAINT fk_studies_workspace "
                        "FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE"
                    )
                )
            else:
                # SQLite is more limited with ALTER TABLE
                await conn.execute(
                    text("ALTER TABLE studies ADD COLUMN workspace_id INTEGER")
                )
                await conn.execute(
                    text(
                        f"UPDATE studies SET workspace_id = {default_ws_id} WHERE workspace_id IS NULL"
                    )
                )

            print("✅ Added 'workspace_id' column to studies")
        else:
            print("⏭️  'studies.workspace_id' column already exists")

    print("--- Migration 002 Complete ---")


if __name__ == "__main__":
    asyncio.run(migrate())
