
import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

from app.database import engine
from sqlalchemy import text, inspect

async def migrate():
    print("Checking database schema for 'show_statement_codes'...")
    async with engine.begin() as conn:
        dialect = conn.dialect.name
        print(f"Detected dialect: {dialect}")
        
        # Check column existence safely
        if dialect == 'sqlite':
            # SQLite: PRAGMA table_info
            result = await conn.execute(text("PRAGMA table_info(studies)"))
            columns = [row.name for row in result.fetchall()]
            exists = 'show_statement_codes' in columns
        else:
            # PostgreSQL: information_schema
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='studies' AND column_name='show_statement_codes'"
            ))
            exists = result.scalar() is not None

        if exists:
            print("Column 'show_statement_codes' already exists.")
        else:
            print("Column missing. Adding 'show_statement_codes'...")
            if dialect == 'sqlite':
                await conn.execute(text("ALTER TABLE studies ADD COLUMN show_statement_codes BOOLEAN DEFAULT 0"))
            else:
                # PostgreSQL
                await conn.execute(text("ALTER TABLE studies ADD COLUMN IF NOT EXISTS show_statement_codes BOOLEAN DEFAULT FALSE"))
            
            print("Column added successfully.")

if __name__ == "__main__":
    asyncio.run(migrate())
