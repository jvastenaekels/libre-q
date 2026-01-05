import asyncio
import os
import sys

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine


async def migrate_branding():
    print("Starting branding migration...")
    async with engine.begin() as conn:
        # Check if branding column exists in studies table
        result = await conn.execute(text("PRAGMA table_info(studies)"))
        columns = [row[1] for row in result.fetchall()]

        if "branding" not in columns:
            print("Adding 'branding' column to studies table...")
            await conn.execute(text("ALTER TABLE studies ADD COLUMN branding JSON"))
            print("Branding column added successfully.")
        else:
            print("Branding column already exists in studies table.")

    print("Migration completed.")


if __name__ == "__main__":
    asyncio.run(migrate_branding())
