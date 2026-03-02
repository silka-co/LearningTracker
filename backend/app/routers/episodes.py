"""Episode management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.episode import Episode
from app.models.podcast import Podcast
from app.schemas.episode import EpisodeResponse, EpisodeListItem
from app.tasks.download_tasks import download_episode_audio

router = APIRouter()


@router.get("", response_model=list[EpisodeListItem])
def list_episodes(
    podcast_id: int | None = Query(None, description="Filter by podcast"),
    topic_id: int | None = Query(None, description="Filter by topic"),
    audio_status: str | None = Query(None, description="Filter by audio status"),
    transcription_status: str | None = Query(None, description="Filter by transcription status"),
    analysis_status: str | None = Query(None, description="Filter by analysis status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List episodes with optional filtering."""
    query = db.query(Episode)

    if podcast_id is not None:
        query = query.filter(Episode.podcast_id == podcast_id)

    if topic_id is not None:
        query = query.join(Podcast).filter(Podcast.topic_id == topic_id)

    if audio_status is not None:
        query = query.filter(Episode.audio_status == audio_status)

    if transcription_status is not None:
        query = query.filter(Episode.transcription_status == transcription_status)

    if analysis_status is not None:
        query = query.filter(Episode.analysis_status == analysis_status)

    episodes = (
        query.order_by(Episode.published_at.desc().nullslast())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [EpisodeListItem.model_validate(e) for e in episodes]


@router.get("/{episode_id}", response_model=EpisodeResponse)
def get_episode(episode_id: int, db: Session = Depends(get_db)):
    """Get full details for a single episode."""
    episode = db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    return EpisodeResponse.model_validate(episode)


@router.post("/{episode_id}/process", response_model=dict)
def process_episode(episode_id: int, db: Session = Depends(get_db)):
    """Manually trigger processing for an episode.

    Starts the download pipeline (download -> transcribe -> analyze).
    Use this for older episodes that weren't auto-queued.
    """
    episode = db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    if episode.audio_status == "downloading":
        raise HTTPException(status_code=409, detail="Episode is already being downloaded")

    if episode.audio_status == "downloaded":
        # Already downloaded, could trigger transcription in Phase 2
        return {
            "message": "Episode already downloaded",
            "episode_id": episode_id,
            "audio_status": episode.audio_status,
        }

    # Reset status and queue for download
    episode.audio_status = "pending"
    episode.error_message = None
    db.commit()

    result = download_episode_audio(episode.id)
    task_id = result.id if hasattr(result, "id") else str(result)

    return {
        "message": "Episode queued for processing",
        "episode_id": episode_id,
        "task_id": task_id,
    }
