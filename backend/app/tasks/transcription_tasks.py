"""Background tasks for transcribing podcast audio files."""

import logging

from app.config import get_settings
from app.database import get_session
from app.models.episode import Episode, Transcript, TranscriptSegment
from app.services.transcriber import TranscriptionError, get_transcription_service

logger = logging.getLogger(__name__)


def transcribe_episode(episode_id: int) -> dict:
    """Transcribe audio for an episode.

    Updates episode status through: pending -> processing -> completed/failed.
    Creates Transcript and TranscriptSegment records on success.
    """
    settings = get_settings()
    session = get_session()

    try:
        episode = session.get(Episode, episode_id)
        if episode is None:
            logger.error("Episode %d not found", episode_id)
            return {"status": "error", "message": "Episode not found"}

        # Skip if already transcribed
        if episode.transcription_status == "completed":
            logger.info("Episode %d already transcribed, skipping", episode_id)
            return {"status": "skipped", "episode_id": episode_id}

        # Must have downloaded audio first
        if episode.audio_status != "downloaded" or not episode.audio_file_path:
            logger.error("Episode %d has no downloaded audio", episode_id)
            episode.transcription_status = "failed"
            episode.error_message = "No audio file available for transcription"
            session.commit()
            return {"status": "error", "message": "No audio file"}

        # Update status to processing
        episode.transcription_status = "processing"
        episode.error_message = None
        session.commit()

        # Run transcription
        service = get_transcription_service(settings)
        result = service.transcribe(episode.audio_file_path)

        # Delete any existing transcript (e.g. from a retry)
        existing = (
            session.query(Transcript)
            .filter(Transcript.episode_id == episode_id)
            .first()
        )
        if existing:
            session.query(TranscriptSegment).filter(
                TranscriptSegment.episode_id == episode_id
            ).delete()
            session.delete(existing)
            session.flush()

        # Create Transcript record
        transcript = Transcript(
            episode_id=episode_id,
            full_text=result.full_text,
            language=result.language,
            word_count=result.word_count,
        )
        session.add(transcript)
        session.flush()

        # Create TranscriptSegment records (batch)
        for seg in result.segments:
            session.add(
                TranscriptSegment(
                    episode_id=episode_id,
                    segment_index=seg.segment_index,
                    start_time=seg.start_time,
                    end_time=seg.end_time,
                    text=seg.text,
                )
            )

        # Update episode status
        episode.transcription_status = "completed"
        session.commit()

        logger.info(
            "Episode %d transcribed: %d segments, %d words, language=%s",
            episode_id,
            len(result.segments),
            result.word_count,
            result.language,
        )

        return {
            "status": "completed",
            "episode_id": episode_id,
            "word_count": result.word_count,
            "segment_count": len(result.segments),
        }

    except TranscriptionError as e:
        logger.error("Failed to transcribe episode %d: %s", episode_id, e)
        try:
            episode = session.get(Episode, episode_id)
            if episode:
                episode.transcription_status = "failed"
                episode.error_message = str(e)
                session.commit()
        except Exception:
            session.rollback()
        raise

    except Exception as e:
        logger.exception("Unexpected error transcribing episode %d", episode_id)
        try:
            episode = session.get(Episode, episode_id)
            if episode:
                episode.transcription_status = "failed"
                episode.error_message = f"Unexpected error: {e}"
                session.commit()
        except Exception:
            session.rollback()
        raise

    finally:
        session.close()
