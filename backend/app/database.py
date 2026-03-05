import sqlite3
from pathlib import Path
from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


_engine = None
_SessionLocal = None


def _get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        # Ensure data directory exists
        db_path = Path(settings.DATABASE_PATH)
        if not db_path.is_absolute():
            db_path = settings.project_root / db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)

        _engine = create_engine(
            settings.database_url,
            connect_args={"check_same_thread": False},
            echo=False,
        )

        # Enable WAL mode and foreign keys on every connection
        @event.listens_for(_engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return _engine


def _get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=_get_engine(), autoflush=False)
    return _SessionLocal


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session."""
    session = _get_session_factory()()
    try:
        yield session
    finally:
        session.close()


def get_session() -> Session:
    """Create a standalone session (for use in Huey tasks, outside FastAPI)."""
    return _get_session_factory()()


def init_db() -> None:
    """Initialize the database by running migration scripts."""
    settings = get_settings()
    db_path = Path(settings.DATABASE_PATH)
    if not db_path.is_absolute():
        db_path = settings.project_root / db_path
    db_path.parent.mkdir(parents=True, exist_ok=True)

    migrations_dir = Path(__file__).parent / "migrations"

    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    for sql_file in sorted(migrations_dir.glob("*.sql")):
        sql = sql_file.read_text()
        try:
            conn.executescript(sql)
        except sqlite3.OperationalError as e:
            # Handle idempotent migrations (e.g. duplicate column from
            # ALTER TABLE, which SQLite has no IF NOT EXISTS for).
            if "duplicate column" in str(e):
                pass
            else:
                raise

    conn.close()
