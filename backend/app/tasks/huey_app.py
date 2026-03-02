"""Huey task queue configuration.

Uses SqliteHuey for zero-infrastructure background task processing.
The consumer is started with: huey_consumer app.tasks.huey_app.huey -w 2 -k process
"""

from huey import SqliteHuey

from app.config import get_settings

settings = get_settings()

huey = SqliteHuey(
    filename=settings.huey_db_full_path,
    immediate=False,
)
