"""Podcast Learning Companion - FastAPI Application."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.routers import topics, podcasts, episodes, tasks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    settings = get_settings()

    # Ensure data directories exist
    settings.audio_dir_path.mkdir(parents=True, exist_ok=True)
    Path(settings.HUEY_DB_PATH).parent.mkdir(parents=True, exist_ok=True)

    # Initialize database (run migrations)
    init_db()
    logger.info("Database initialized at %s", settings.DATABASE_PATH)

    yield

    logger.info("Shutting down")


app = FastAPI(
    title="Podcast Learning Companion",
    description="AI-powered podcast learning with summaries, Q&A, and quizzes",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for frontend dev server
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(topics.router, prefix="/api/topics", tags=["topics"])
app.include_router(podcasts.router, prefix="/api/podcasts", tags=["podcasts"])
app.include_router(episodes.router, prefix="/api/episodes", tags=["episodes"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])


@app.get("/api/health")
def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "version": "0.1.0"}
