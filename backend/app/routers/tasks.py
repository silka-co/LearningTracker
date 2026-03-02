"""Background task status endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.episode import Episode

router = APIRouter()


@router.get("/episode/{episode_id}/status")
def get_episode_processing_status(episode_id: int, db: Session = Depends(get_db)):
    """Get the processing pipeline status for an episode.

    Returns the current status of each pipeline stage:
    audio, transcription, and analysis.
    """
    episode = db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    return {
        "episode_id": episode.id,
        "title": episode.title,
        "audio_status": episode.audio_status,
        "transcription_status": episode.transcription_status,
        "analysis_status": episode.analysis_status,
        "error_message": episode.error_message,
        "audio_file_path": episode.audio_file_path,
    }


@router.get("/processing")
def get_processing_episodes(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List all episodes currently being processed.

    Returns episodes that have any non-terminal status
    (downloading, processing, etc.).
    """
    episodes = (
        db.query(Episode)
        .filter(
            (Episode.audio_status.in_(["downloading"]))
            | (Episode.transcription_status.in_(["processing"]))
            | (Episode.analysis_status.in_(["processing"]))
        )
        .order_by(Episode.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "episode_id": e.id,
            "title": e.title,
            "podcast_id": e.podcast_id,
            "audio_status": e.audio_status,
            "transcription_status": e.transcription_status,
            "analysis_status": e.analysis_status,
        }
        for e in episodes
    ]
