"""Background tasks for AI analysis of podcast transcripts."""

import json
import logging

from app.config import get_settings
from app.database import get_session
from app.models.episode import Episode, Transcript, EpisodeSummary
from app.services.analyzer import AnalysisError, AnalysisService

logger = logging.getLogger(__name__)


def analyze_episode(episode_id: int) -> dict:
    """Analyze a transcribed episode using Claude AI.

    Updates episode status through: pending -> processing -> completed/failed.
    Creates an EpisodeSummary record on success.
    """
    settings = get_settings()
    session = get_session()

    try:
        episode = session.get(Episode, episode_id)
        if episode is None:
            logger.error("Episode %d not found", episode_id)
            return {"status": "error", "message": "Episode not found"}

        # Skip if already analyzed
        if episode.analysis_status == "completed":
            logger.info("Episode %d already analyzed, skipping", episode_id)
            return {"status": "skipped", "episode_id": episode_id}

        # Must have a transcript
        transcript = (
            session.query(Transcript)
            .filter(Transcript.episode_id == episode_id)
            .first()
        )
        if not transcript:
            logger.error("Episode %d has no transcript", episode_id)
            episode.analysis_status = "failed"
            episode.error_message = "No transcript available for analysis"
            session.commit()
            return {"status": "error", "message": "No transcript"}

        # Update status to processing
        episode.analysis_status = "processing"
        episode.error_message = None
        session.commit()

        # Run analysis
        service = AnalysisService(api_key=settings.ANTHROPIC_API_KEY)
        result = service.analyze(
            transcript_text=transcript.full_text,
            episode_title=episode.title,
        )

        # Delete any existing summary (e.g. from a retry)
        existing = (
            session.query(EpisodeSummary)
            .filter(EpisodeSummary.episode_id == episode_id)
            .first()
        )
        if existing:
            session.delete(existing)
            session.flush()

        # Create EpisodeSummary record
        summary = EpisodeSummary(
            episode_id=episode_id,
            one_line=result.one_line,
            short_summary=result.short_summary,
            detailed_summary=result.detailed_summary,
            key_points=json.dumps(result.key_points),
            notable_quotes=json.dumps(result.notable_quotes),
        )
        session.add(summary)

        # Update episode status
        episode.analysis_status = "completed"
        session.commit()

        logger.info(
            "Episode %d analyzed: %d key points, %d quotes",
            episode_id,
            len(result.key_points),
            len(result.notable_quotes),
        )
        return {
            "status": "completed",
            "episode_id": episode_id,
            "key_points": len(result.key_points),
            "notable_quotes": len(result.notable_quotes),
        }

    except AnalysisError as e:
        logger.error("Failed to analyze episode %d: %s", episode_id, e)
        try:
            episode = session.get(Episode, episode_id)
            if episode:
                episode.analysis_status = "failed"
                episode.error_message = str(e)
                session.commit()
        except Exception:
            session.rollback()
        raise

    except Exception as e:
        logger.exception("Unexpected error analyzing episode %d", episode_id)
        try:
            episode = session.get(Episode, episode_id)
            if episode:
                episode.analysis_status = "failed"
                episode.error_message = f"Unexpected error: {e}"
                session.commit()
        except Exception:
            session.rollback()
        raise

    finally:
        session.close()
