# Open-Q - Open-source platform for conducting Q-methodology research
# Copyright (C) 2025 Julien Vastenekels
# Licensed under the GNU Affero General Public License v3.0 or later.

import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

# For local development with SQLite
# On Scalingo/Production, this will be provided via DATABASE_URL
# Ensure DB path is absolute to avoid CWD issues
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "q_method.db")
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{DB_PATH}")

# Fix for SQLAlchemy + asyncpg: "postgres://" or "postgresql://" -> "postgresql+asyncpg://"
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgresql://"):
     SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# asyncpg doesn't support the 'sslmode' query parameter. 
# We strip it if present to avoid TypeError.
if "sslmode=" in SQLALCHEMY_DATABASE_URL:
    from urllib.parse import urlparse, urlunparse, parse_qs, urlencode
    u = urlparse(SQLALCHEMY_DATABASE_URL)
    q = parse_qs(u.query)
    q.pop("sslmode", None)
    SQLALCHEMY_DATABASE_URL = urlunparse(u._replace(query=urlencode(q, doseq=True)))

engine_kwargs = {
    "echo": False,
}

# SQLite doesn't support these pool settings
if not SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_timeout": 30,
        "pool_recycle": 1800,
    })

engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    **engine_kwargs
)

SessionLocal = async_sessionmaker(
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    bind=engine,
    class_=AsyncSession
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with SessionLocal() as db:
        yield db
