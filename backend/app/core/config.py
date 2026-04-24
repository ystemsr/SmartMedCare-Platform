"""Application configuration loaded from environment variables."""

from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Global application settings backed by .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    APP_NAME: str = "SmartMedCare"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    JWT_REFRESH_TOKEN_EXPIRE_MINUTES: int = 10080

    # MySQL
    MYSQL_HOST: str = "mysql"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "smartmedcare"
    MYSQL_PASSWORD: str = "smartmedcare123"
    MYSQL_DATABASE: str = "smartmedcare"

    # Redis
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    # MinIO
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "smartmedcare"
    MINIO_SECURE: bool = False

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Weather (OpenWeatherMap)
    WEATHER_API_KEY: str = ""
    WEATHER_DEFAULT_CITY: str = "Beijing"
    WEATHER_REFRESH_SECONDS: int = 1800  # 30 minutes

    # Qdrant (vector database for RAG knowledge base)
    QDRANT_URL: str = "http://qdrant:6333"
    QDRANT_API_KEY: str = ""

    # RAG knowledge base — chunking + embedding model.
    # Embedding provider is OpenAI-compatible; defaults to OpenRouter.
    KB_EMBEDDING_BASE_URL: str = "https://openrouter.ai/api/v1"
    KB_EMBEDDING_API_KEY: str = ""
    KB_EMBEDDING_MODEL: str = "qwen/qwen3-embedding-8b"
    KB_EMBEDDING_DIM: int = 4096
    KB_CHUNK_SIZE: int = 512
    KB_CHUNK_OVERLAP: int = 128
    KB_TOP_K: int = 5

    # Big data pipeline scheduler — bootstrap defaults when no DB config exists.
    # After an admin saves a schedule through the UI, the DB value overrides these.
    PIPELINE_SCHEDULE_ENABLED: bool = True
    # Fallback trigger time in UTC, HH:MM (24h). 19:00 UTC = 03:00 Asia/Shanghai.
    PIPELINE_SCHEDULE_UTC_TIME: str = "19:00"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: object) -> list:
        """Accept both JSON string and list for CORS origins."""
        if isinstance(v, str):
            import json
            return json.loads(v)
        return v

    @property
    def database_url(self) -> str:
        """Async database URL for aiomysql driver."""
        return (
            f"mysql+aiomysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
            "?charset=utf8mb4"
        )

    @property
    def sync_database_url(self) -> str:
        """Synchronous database URL for Alembic migrations."""
        return (
            f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
            "?charset=utf8mb4"
        )


settings = Settings()
