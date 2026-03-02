from pathlib import Path
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Paths (relative to project root, resolved at runtime)
    DATABASE_PATH: str = "data/podcast_learning.db"
    AUDIO_DIR: str = "data/audio"
    HUEY_DB_PATH: str = "data/huey.db"

    # Anthropic API (Phase 3)
    ANTHROPIC_API_KEY: str = ""

    # Whisper transcription (Phase 2)
    WHISPER_MODEL: str = "medium"
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "int8"

    # Server
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:5173"

    # Auto-processing
    AUTO_DOWNLOAD_RECENT: int = 5

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def project_root(self) -> Path:
        """Project root is two levels up from this file (backend/app/config.py -> project root)."""
        return Path(__file__).resolve().parent.parent.parent

    @property
    def database_url(self) -> str:
        db_path = self.project_root / self.DATABASE_PATH
        return f"sqlite:///{db_path}"

    @property
    def audio_dir_path(self) -> Path:
        return self.project_root / self.AUDIO_DIR

    @property
    def huey_db_full_path(self) -> str:
        return str(self.project_root / self.HUEY_DB_PATH)


@lru_cache
def get_settings() -> Settings:
    return Settings()
