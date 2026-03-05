"""Background tasks for downloading podcast audio files."""

import logging
from datetime import datetime, timezone

from app.tasks.executor import submit_task
from app.config import get_settings
from app.database import get_session
from app.models.episode import Episode
from app.models.podcast import Podcast
from app.services.audio_downloader import AudioDownloader, DownloadError

logger = logging.getLogger(__name__)


def download_episode_audio(episode_id: int) -> dict:
    """Download audio for an episode.

    Updates episode status through: pending -> downloading -> downloaded/failed.
    On success, sets audio_file_path.
    On failure after retries, sets error_message.
    """
    settings = get_settings()
    session = get_session()
    downloader = AudioDownloader(settings.audio_dir_path)

    try:
        episode = session.get(Episode, episode_id)
        if episode is None:
            logger.error("Episode %d not found", episode_id)
            return {"status": "error", "message": "Episode not found"}

        # Skip if already downloaded
        if episode.audio_status == "downloaded":
            logger.info("Episode %d already downloaded, skipping", episode_id)
            return {"status": "skipped", "episode_id": episode_id}

        # Update status to downloading
        episode.audio_status = "downloading"
        episode.error_message = None
        session.commit()

        # Download the file
        file_path = downloader.download(
            url=episode.audio_url,
            podcast_id=episode.podcast_id,
            episode_id=episode.id,
        )

        # Update status to downloaded
        episode.audio_status = "downloaded"
        episode.audio_file_path = str(file_path)
        session.commit()

        logger.info("Episode %d downloaded successfully: %s", episode_id, file_path)
        return {"status": "downloaded", "episode_id": episode_id, "path": str(file_path)}

    except DownloadError as e:
        logger.error("Failed to download episode %d: %s", episode_id, e)
        try:
            episode = session.get(Episode, episode_id)
            if episode:
                episode.audio_status = "failed"
                episode.error_message = str(e)
                session.commit()
        except Exception:
            session.rollback()
        raise

    except Exception as e:
        logger.exception("Unexpected error downloading episode %d", episode_id)
        try:
            episode = session.get(Episode, episode_id)
            if episode:
                episode.audio_status = "failed"
                episode.error_message = f"Unexpected error: {e}"
                session.commit()
        except Exception:
            session.rollback()
        raise

    finally:
        session.close()


# ── Chaining helpers ──────────────────────────────────────────────


def _chain_after_download(result: dict) -> None:
    """Called after a successful download to queue transcription."""
    from app.tasks.transcription_tasks import transcribe_episode

    if result.get("status") == "downloaded":
        episode_id = result["episode_id"]
        logger.info("Chaining: download -> transcribe for episode %d", episode_id)
        submit_task(
            transcribe_episode,
            episode_id,
            retries=2,
            retry_delay=120,
            on_success=_chain_after_transcribe,
            task_name="transcribe_episode",
        )


def _chain_after_transcribe(result: dict) -> None:
    """Called after successful transcription to queue analysis."""
    from app.tasks.analysis_tasks import analyze_episode

    if result.get("status") == "completed":
        episode_id = result["episode_id"]
        logger.info("Chaining: transcribe -> analyze for episode %d", episode_id)
        submit_task(
            analyze_episode,
            episode_id,
            retries=2,
            retry_delay=60,
            task_name="analyze_episode",
        )


# ── Queue helpers ─────────────────────────────────────────────────


def queue_episode_pipeline(episode_id: int) -> str:
    """Submit an episode for the full pipeline: download -> transcribe -> analyze.

    Returns a task ID string.
    """
    return submit_task(
        download_episode_audio,
        episode_id,
        retries=3,
        retry_delay=60,
        on_success=_chain_after_download,
        task_name="download_episode_audio",
    )


def queue_recent_episodes(podcast_id: int, count: int = 5) -> list[str]:
    """Queue the N most recent episodes of a podcast for the full pipeline.

    Returns list of task IDs.
    """
    session = get_session()
    try:
        episodes = (
            session.query(Episode)
            .filter(
                Episode.podcast_id == podcast_id,
                Episode.audio_status == "pending",
            )
            .order_by(Episode.published_at.desc().nullslast())
            .limit(count)
            .all()
        )

        task_ids = []
        for episode in episodes:
            task_id = queue_episode_pipeline(episode.id)
            task_ids.append(task_id)

        logger.info(
            "Queued %d episodes for processing from podcast %d",
            len(task_ids),
            podcast_id,
        )
        return task_ids

    finally:
        session.close()


def queue_new_episodes(podcast_id: int) -> list[str]:
    """Queue all pending episodes of a podcast for the full pipeline.

    Used when refreshing a feed to process newly discovered episodes.
    """
    session = get_session()
    try:
        episodes = (
            session.query(Episode)
            .filter(
                Episode.podcast_id == podcast_id,
                Episode.audio_status == "pending",
            )
            .order_by(Episode.published_at.desc().nullslast())
            .all()
        )

        task_ids = []
        for episode in episodes:
            task_id = queue_episode_pipeline(episode.id)
            task_ids.append(task_id)

        logger.info(
            "Queued %d new episodes for processing from podcast %d",
            len(task_ids),
            podcast_id,
        )
        return task_ids

    finally:
        session.close()
