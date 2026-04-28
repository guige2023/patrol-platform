from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    PROJECT_NAME: str = "巡察工作管理平台"
    VERSION: str = "3.2.0"
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/patrol"
    SYNC_DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/patrol"

    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    ENCRYPTION_KEY: str = "your-32-byte-encryption-key-here"

    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "patrol-files"

    MEILISEARCH_URL: str = "http://127.0.0.1:7700"
    MEILISEARCH_KEY: str = ""

    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3070"
    SERVE_UPLOADS: bool = False

    RUNTIME_DIR: str = "runtime"
    UPLOAD_DIR: str = ""
    BACKUP_DIR: str = ""
    DOCUMENTS_DIR: str = ""
    LIBREOFFICE_CMD: str = "libreoffice"

    class Config:
        env_file = ".env"

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
