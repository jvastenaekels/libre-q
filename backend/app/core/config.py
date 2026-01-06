"""Application configuration."""

import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration."""

    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "Open-Q API"

    # Security
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY", "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./sql_app.db")

    # Frontend
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # Mail
    SMTP_TLS: bool = os.getenv("SMTP_TLS", "True") == "True"
    SMTP_PORT: int | None = (
        int(os.getenv("SMTP_PORT", "587")) if os.getenv("SMTP_PORT") else None
    )
    SMTP_HOST: str | None = os.getenv("SMTP_HOST")
    SMTP_USER: str | None = os.getenv("SMTP_USER")
    SMTP_PASSWORD: str | None = os.getenv("SMTP_PASSWORD")
    EMAILS_FROM_EMAIL: str | None = os.getenv("EMAILS_FROM_EMAIL")
    EMAILS_FROM_NAME: str = os.getenv("EMAILS_FROM_NAME", PROJECT_NAME)

    model_config = SettingsConfigDict(
        env_file=".env", case_sensitive=True, extra="ignore"
    )


settings = Settings()
