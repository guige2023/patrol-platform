from typing import Optional
from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path
import os


# Sentinel used to detect "not set" vs "intentionally empty"
_UNSET = object()


class Settings(BaseSettings):
    PROJECT_NAME: str = "巡察工作管理平台"
    VERSION: str = "3.2.0"
    API_V1_PREFIX: str = "/api/v1"

    # Use None as sentinel — if left as None after env loading, app won't start
    DATABASE_URL: Optional[str] = None
    SYNC_DATABASE_URL: Optional[str] = None

    SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    ENCRYPTION_KEY: Optional[str] = None

    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: Optional[str] = None
    MINIO_SECRET_KEY: Optional[str] = None
    MINIO_BUCKET: str = "patrol-files"

    MEILISEARCH_URL: str = "http://127.0.0.1:7700"
    MEILISEARCH_KEY: str = ""

    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3005,http://localhost:3070,http://localhost:3071,http://localhost:3072"
    SERVE_UPLOADS: bool = False

    RUNTIME_DIR: str = "runtime"
    UPLOAD_DIR: str = ""
    BACKUP_DIR: str = ""
    DOCUMENTS_DIR: str = ""
    LIBREOFFICE_CMD: str = "libreoffice"

    class Config:
        env_file = ".env"
        extra = "ignore"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._validate_required_secrets()

    def _validate_required_secrets(self):
        """Fail fast at startup if critical secrets are missing or still at weak defaults."""
        # Skip validation in test mode (set by conftest or CI)
        if os.environ.get("TESTING") == "1":
            return
        weak_marker_values = {
            # Only flag the placeholder string (not localhost dev URLs)
            "SECRET_KEY": ["your-secret-key-change-in-production", "changeme"],
            "ENCRYPTION_KEY": ["your-32-byte-encryption-key-here", "changeme"],
            # Don't flag localhost dev URLs — they're normal for local development
            # Only flag non-localhost URLs with weak credentials
            "DATABASE_URL": [],
            "MINIO_ACCESS_KEY": ["minioadmin"],
            "MINIO_SECRET_KEY": ["minioadmin"],
        }
        for field, weak_values in weak_marker_values.items():
            current = getattr(self, field, None)
            if current is None:
                raise ValueError(
                    f"Configuration error: {field} is not set. "
                    f"Set the {field} environment variable in your .env file."
                )
            if any(w in current for w in weak_values):
                raise ValueError(
                    f"SECURITY WARNING: {field} is set to a known-weak default value. "
                    f"Please set a strong value in your .env file before running in production."
                )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def runtime_path(self) -> Path:
        base_dir = Path(__file__).resolve().parents[2]
        runtime_dir = Path(self.RUNTIME_DIR)
        return runtime_dir if runtime_dir.is_absolute() else base_dir / runtime_dir

    def resolve_path(self, value: str, default_child: str) -> Path:
        path = Path(value) if value else self.runtime_path / default_child
        return path if path.is_absolute() else self.runtime_path / path

    @property
    def upload_path(self) -> Path:
        return self.resolve_path(self.UPLOAD_DIR, "uploads")

    @property
    def backup_path(self) -> Path:
        return self.resolve_path(self.BACKUP_DIR, "backups")

    @property
    def documents_path(self) -> Path:
        return self.resolve_path(self.DOCUMENTS_DIR, "documents")


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()
