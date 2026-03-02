"""Background tasks for downloading podcast audio files."""

import logging
from datetime import datetime, timezone

from app.tasks.huey_app import huey
from app.config import get_settings
from app.database import get_session
from app.models.episode import Episode
from app.models.podcast import Podcast
from app.services.audio_downloader import AudioDownloader, DownloadError

logger = logging.getLogger(__name__)


@huey.task(retries=3, retry_delay=60)
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
        raise  # Re-raise so Huey can retry

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


def queue_recent_episodes(podcast_id: int, count: int = 5) -> list[str]:
    """Queue the N most recent episodes of a podcast for download.

    Returns list of Huey task IDs.
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
            result = download_episode_audio(episode.id)
            task_ids.append(result.id if hasattr(result, "id") else str(result))

        logger.info(
            "Queued %d episodes for download from podcast %d",
            len(task_ids),
            podcast_id,
        )
        return task_ids

    finally:
        session.close()


def queue_new_episodes(podcast_id: int) -> list[str]:
    """Queue all pending episodes of a podcast for download.

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
            result = download_episode_audio(episode.id)
            task_ids.append(result.id if hasattr(result, "id") else str(result))

        logger.info(
            "Queued %d new episodes for download from podcast %d",
            len(task_ids),
            podcast_id,
        )
        return task_ids

    finally:
        session.close()
