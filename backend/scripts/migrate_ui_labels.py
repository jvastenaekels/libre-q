import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect
from app.database import engine


async def migrate():
    print("Checking for missing 'ui_labels' column in 'study_translations' table...")

    async with engine.connect() as conn:
        # Use sync inspector via run_sync
        def check_column(connection):
            inspector = inspect(connection)
            columns = [c["name"] for c in inspector.get_columns("study_translations")]
            return "ui_labels" in columns

        has_column = await conn.run_sync(check_column)

        if has_column:
            print("Column 'ui_labels' already exists.")
            return

        print("Column 'ui_labels' missing. Adding it...")
        # Add column based on dialect
        dialect = conn.dialect.name
        if dialect == "postgresql":
            await conn.execute(
                text(
                    "ALTER TABLE study_translations ADD COLUMN ui_labels JSON DEFAULT '{}'::json"
                )
            )
        else:
            # SQLite doesn't support JSON type natively in ALTER TABLE usually, but SQLAlchemy maps it to TEXT or JSON
            # For SQLite, we can just add it as JSON (valid in modern SQLite) or TEXT
            await conn.execute(
                text(
                    "ALTER TABLE study_translations ADD COLUMN ui_labels JSON DEFAULT '{}'"
                )
            )

        await conn.commit()
        print("Successfully added 'ui_labels' column.")


if __name__ == "__main__":
    asyncio.run(migrate())
