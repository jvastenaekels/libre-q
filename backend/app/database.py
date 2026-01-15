# Open-Q - Open-source platform for conducting Q-methodology research
# Copyright (C) 2025 Julien Vastenekels
# Licensed under the GNU Affero General Public License v3.0 or later.

"""Database configuration and session management."""

import os
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# For local development with SQLite
# On Scalingo/Production, this will be provided via DATABASE_URL
# Ensure DB path is absolute to avoid CWD issues
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "q_method.db")

SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

# Fix for SQLAlchemy + asyncpg: "postgres://" or "postgresql://" -> "postgresql+asyncpg://"
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace(
        "postgres://", "postgresql+asyncpg://", 1
    )
elif SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgresql://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace(
        "postgresql://", "postgresql+asyncpg://", 1
    )

# asyncpg doesn't support the 'sslmode' query parameter.
# We strip it if present to avoid TypeError.
if "sslmode=" in SQLALCHEMY_DATABASE_URL:
    from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

    u = urlparse(SQLALCHEMY_DATABASE_URL)
    q = parse_qs(u.query)
    q.pop("sslmode", None)
    SQLALCHEMY_DATABASE_URL = urlunparse(u._replace(query=urlencode(q, doseq=True)))

engine_kwargs: dict[str, Any] = {
    "echo": False,
}

# SQLite doesn't support these pool settings
if not SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_kwargs.update(
        {
            "pool_size": 10,
            "max_overflow": 20,
            "pool_timeout": 30,
            "pool_recycle": 1800,
        }
    )

engine = create_async_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)

SessionLocal = async_sessionmaker(
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    bind=engine,
    class_=AsyncSession,
)


class Base(DeclarativeBase):
    """Base class for SQLAlchemy declarative models."""

    pass


async def get_db():
    """Dependency that provides an async database session."""
    async with SessionLocal() as db:
        yield db
