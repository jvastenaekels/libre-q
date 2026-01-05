import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect
from app.database import engine


async def migrate_studies():
    print("Checking 'studies' table for missing columns...")

    async with engine.connect() as conn:
        # Use sync inspector
        def get_columns(connection, table_name):
            inspector = inspect(connection)
            return [c["name"] for c in inspector.get_columns(table_name)]

        columns_studies = await conn.run_sync(lambda c: get_columns(c, "studies"))

        # 1. randomize_statements
        if "randomize_statements" not in columns_studies:
            print("Column 'randomize_statements' missing. Adding it...")
            await conn.execute(
                text(
                    "ALTER TABLE studies ADD COLUMN randomize_statements BOOLEAN DEFAULT 0"
                )
            )
        else:
            print("Column 'randomize_statements' already exists.")

        # 2. show_statement_codes
        if "show_statement_codes" not in columns_studies:
            print("Column 'show_statement_codes' missing. Adding it...")
            await conn.execute(
                text(
                    "ALTER TABLE studies ADD COLUMN show_statement_codes BOOLEAN DEFAULT 0"
                )
            )
        else:
            print("Column 'show_statement_codes' already exists.")

        await conn.commit()
        print("Studies table migration complete.")


async def migrate_translations():
    print("Checking 'study_translations' table for missing columns...")
    async with engine.connect() as conn:

        def get_columns(connection, table_name):
            inspector = inspect(connection)
            return [c["name"] for c in inspector.get_columns(table_name)]

        columns_trans = await conn.run_sync(
            lambda c: get_columns(c, "study_translations")
        )

        # 3. ui_labels
        if "ui_labels" not in columns_trans:
            print("Column 'ui_labels' missing. Adding it...")
            dialect = conn.dialect.name
            if dialect == "postgresql":
                await conn.execute(
                    text(
                        "ALTER TABLE study_translations ADD COLUMN ui_labels JSON DEFAULT '{}'::json"
                    )
                )
            else:
                await conn.execute(
                    text(
                        "ALTER TABLE study_translations ADD COLUMN ui_labels JSON DEFAULT '{}'"
                    )
                )
        else:
            print("Column 'ui_labels' already exists.")

        await conn.commit()
        print("Translations table migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate_studies())
    asyncio.run(migrate_translations())
