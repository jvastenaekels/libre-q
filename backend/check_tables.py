"""Check database tables."""

import asyncio
from sqlalchemy import inspect
from app.database import engine


async def check_tables():
    async with engine.connect() as conn:
        tables = await conn.run_sync(lambda c: inspect(c).get_table_names())
        print("Existing tables:")
        for table in sorted(tables):
            print(f"  - {table}")

        # Check for workspace-related tables
        workspace_tables = ["workspaces", "workspace_members", "study_collaborators"]
        missing = [t for t in workspace_tables if t not in tables]

        if missing:
            print(f"\n⚠️  Missing tables: {', '.join(missing)}")
            print("Need to run database initialization/migration!")
        else:
            print("\n✓ All workspace tables exist")


if __name__ == "__main__":
    asyncio.run(check_tables())
