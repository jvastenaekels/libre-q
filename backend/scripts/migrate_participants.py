"""Migration script to add missing participants.random_seed column.

This column was added to support deterministic statement randomization
but wasn't migrated in existing databases.
"""

import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect
from app.database import engine


async def migrate_participants():
    print("Checking 'participants' table for missing columns...")

    async with engine.connect() as conn:
        # Use sync inspector
        def get_columns(connection, table_name):
            inspector = inspect(connection)
            return [c["name"] for c in inspector.get_columns(table_name)]

        columns_participants = await conn.run_sync(
            lambda c: get_columns(c, "participants")
        )

        # Add random_seed column if missing
        if "random_seed" not in columns_participants:
            print("Column 'random_seed' missing. Adding it...")
            await conn.execute(
                text("ALTER TABLE participants ADD COLUMN random_seed VARCHAR")
            )
            print("✓ Added 'random_seed' column")
        else:
            print("✓ Column 'random_seed' already exists.")

        await conn.commit()
        print("\nParticipants table migration complete!")


if __name__ == "__main__":
    asyncio.run(migrate_participants())
