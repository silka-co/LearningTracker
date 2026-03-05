import os
from pathlib import Path
from functools import lru_cache

from pydantic_settings import BaseSettings


_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


def _load_env_file() -> dict[str, str]:
    """Load .env file values, used to fill in empty env vars."""
    values: dict[str, str] = {}
    if _ENV_FILE.exists():
        for line in _ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                values[key.strip()] = val.strip()
    return values


# Pre-populate empty env vars from .env so pydantic_settings picks them up
for _k, _v in _load_env_file().items():
    if not os.environ.get(_k):
        os.environ[_k] = _v


class Settings(BaseSettings):
    # Paths (relative to project root, resolved at runtime)
    DATABASE_PATH: str = "data/podcast_learning.db"
    AUDIO_DIR: str = "data/audio"
    # Anthropic API
    ANTHROPIC_API_KEY: str = ""

    # Transcription
    TRANSCRIPTION_BACKEND: str = "assemblyai"  # "assemblyai" or "local"
    ASSEMBLYAI_API_KEY: str = ""

    # Local Whisper fallback (only used when TRANSCRIPTION_BACKEND=local)
    WHISPER_MODEL: str = "medium"
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "int8"

    # Server
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:5173"

    # Auto-processing
    AUTO_DOWNLOAD_RECENT: int = 5

    model_config = {
        "env_file": str(_ENV_FILE),
        "env_file_encoding": "utf-8",
    }

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
