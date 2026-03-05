"""Episode management endpoints."""

import json
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.episode import Episode, Transcript, TranscriptSegment, EpisodeSummary, episode_topics
from app.models.podcast import Podcast
from app.models.topic import Topic
from app.schemas.episode import EpisodeResponse, EpisodeListItem, EpisodeTopicUpdate, EpisodeTopicToggle
from app.schemas.transcript import TranscriptResponse
from app.schemas.analysis import EpisodeSummaryResponse, InsightItem, InsightTopic
from app.tasks.executor import submit_task
from app.tasks.download_tasks import (
    download_episode_audio,
    queue_episode_pipeline,
    _chain_after_download,
    _chain_after_transcribe,
)
from app.tasks.transcription_tasks import transcribe_episode
from app.tasks.analysis_tasks import analyze_episode

router = APIRouter()


@router.get("/new/count")
def get_new_episodes_count(db: Session = Depends(get_db)):
    """Get the count of unprocessed episodes from the last month."""
    one_month_ago = datetime.now(timezone.utc) - timedelta(days=30)
    count = (
        db.query(func.count(Episode.id))
        .filter(
            Episode.trashed_at.is_(None),
            Episode.published_at >= one_month_ago,
            Episode.analysis_status != "completed",
        )
        .scalar()
    )
    return {"count": count}


@router.get("/insights", response_model=list[InsightItem])
def list_insights(
    days: int | None = Query(None, ge=1, le=365, description="How many days back to look (omit for no limit)"),
    topic_id: int | None = Query(None, description="Filter by topic"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get recently analyzed episodes with summaries and topics for the insights timeline."""
    query = db.query(EpisodeSummary)

    if days is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.filter(EpisodeSummary.created_at >= cutoff)

    if topic_id is not None:
        # Only include summaries whose episode is tagged with this topic
        query = query.filter(
            EpisodeSummary.episode_id.in_(
                db.query(episode_topics.c.episode_id).filter(episode_topics.c.topic_id == topic_id)
            )
        )

    summaries = (
        query.order_by(EpisodeSummary.created_at.desc())
        .limit(limit)
        .all()
    )

    result = []
    podcast_cache: dict[int | None, str | None] = {}

    for summary in summaries:
        episode = db.get(Episode, summary.episode_id)
        if not episode or episode.trashed_at is not None:
            continue

        if episode.podcast_id not in podcast_cache:
            podcast = db.get(Podcast, episode.podcast_id) if episode.podcast_id else None
            podcast_cache[episode.podcast_id] = podcast.title if podcast else None

        topics = [
            InsightTopic(id=t.id, name=t.name, color=t.color)
            for t in episode.topics
        ]

        result.append(InsightItem(
            episode_id=episode.id,
            episode_title=episode.title,
            podcast_title=podcast_cache[episode.podcast_id],
            published_at=episode.published_at,
            short_summary=summary.short_summary,
            analyzed_at=summary.created_at,
            topics=topics,
        ))

    return result


@router.get("", response_model=list[EpisodeListItem])
def list_episodes(
    podcast_id: int | None = Query(None, description="Filter by podcast"),
    topic_id: int | None = Query(None, description="Filter by topic"),
    has_topic: bool | None = Query(None, description="Filter to episodes that have any topic assigned"),
    audio_status: str | None = Query(None, description="Filter by audio status"),
    transcription_status: str | None = Query(None, description="Filter by transcription status"),
    analysis_status: str | None = Query(None, description="Filter by analysis status"),
    trashed: bool = Query(False, description="Show trashed episodes"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List episodes with optional filtering."""
    query = db.query(Episode)

    if trashed:
        query = query.filter(Episode.trashed_at.isnot(None))
    else:
        query = query.filter(Episode.trashed_at.is_(None))

    if podcast_id is not None:
        query = query.filter(Episode.podcast_id == podcast_id)

    if topic_id is not None:
        query = query.filter(
            Episode.id.in_(
                db.query(episode_topics.c.episode_id).filter(episode_topics.c.topic_id == topic_id)
            )
        )

    if has_topic is True:
        query = query.filter(
            Episode.id.in_(
                db.query(episode_topics.c.episode_id)
            )
        )

    if audio_status is not None:
        query = query.filter(Episode.audio_status == audio_status)

    if transcription_status is not None:
        query = query.filter(Episode.transcription_status == transcription_status)

    if analysis_status is not None:
        query = query.filter(Episode.analysis_status == analysis_status)

    # Sort pending (unprocessed) episodes before processed ones,
    # then chronologically within each group
    pending_first = case(
        (
            (Episode.audio_status == "pending")
            & (Episode.transcription_status == "pending")
            & (Episode.analysis_status == "pending"),
            0,
        ),
        else_=1,
    )

    episodes = (
        query.order_by(pending_first, Episode.published_at.desc().nullslast())
        .offset(offset)
        .limit(limit)
        .all()
    )

    # Include podcast title and topic names for each episode
    result = []
    podcast_cache: dict[int | None, str | None] = {None: None}
    topic_cache: dict[int, str] = {}
    for e in episodes:
        item = EpisodeListItem.model_validate(e)
        if e.podcast_id not in podcast_cache:
            podcast = db.get(Podcast, e.podcast_id)
            podcast_cache[e.podcast_id] = podcast.title if podcast else None
        item.podcast_title = podcast_cache[e.podcast_id]

        # Many-to-many topics
        ep_topic_ids = []
        ep_topic_names = []
        for t in e.topics:
            if t.id not in topic_cache:
                topic_cache[t.id] = t.name
            ep_topic_ids.append(t.id)
            ep_topic_names.append(topic_cache[t.id])
        item.topic_ids = ep_topic_ids
        item.topic_names = ep_topic_names

        # Backwards compat: first topic
        item.topic_id = ep_topic_ids[0] if ep_topic_ids else None
        item.topic_name = ep_topic_names[0] if ep_topic_names else None

        result.append(item)
    return result


@router.get("/{episode_id}", response_model=EpisodeResponse)
def get_episode(episode_id: int, db: Session = Depends(get_db)):
    """Get full details for a single episode."""
    episode = db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    resp = EpisodeResponse.model_validate(episode)
    resp.topic_ids = [t.id for t in episode.topics]
    resp.topic_names = [t.name for t in episode.topics]
    return resp


@router.patch("/{episode_id}/topic", response_model=dict)
def update_episode_topic(
    episode_id: int,
    body: EpisodeTopicUpdate,
    db: Session = Depends(get_db),
):
    """Set or change the topic for an episode."""
    episode = db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    if body.topic_id is not None:
        topic = db.get(Topic, body.topic_id)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")

    episode.topic_id = body.topic_id
    db.commit()
    return {"message": "Topic updated", "episode_id": episode_id, "topic_id": body.topic_id}


@router.post("/{episode_id}/topics/toggle", response_model=dict)
def toggle_episode_topic(
    episode_id: int,
    body: EpisodeTopicToggle,
    db: Session = Depends(get_db),
):
    """Toggle a topic on/off for an episode (many-to-many)."""
    episode = db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    topic = db.get(Topic, body.topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    if topic in episode.topics:
        episode.topics.remove(topic)
        action = "removed"
    else:
        episode.topics.append(topic)
        action = "added"

    # Keep legacy topic_id in sync (first topic or None)
    episode.topic_id = episode.topics[0].id if episode.topics else None
    db.commit()

    return {
        "message": f"Topic {action}",
        "episode_id": episode_id,
        "topic_id": body.topic_id,
        "action": action,
        "topic_ids": [t.id for t in episode.topics],
    }


@router.get("/{episode_id}/transcript", response_model=TranscriptResponse)
def get_transcript(episode_id: int, db: Session = Depends(get_db)):
    """Get the transcript for an episode with timestamped segments."""
    episode = db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    transcript = (
        db.query(Transcript)
        .filter(Transcript.episode_id == episode_id)
        .first()
    )
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not available")

    segments = (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.episode_id == episode_id)
        .order_by(TranscriptSegment.segment_index)
        .all()
    )

    return TranscriptResponse(
        id=transcript.id,
        episode_id=transcript.episode_id,
        full_text=transcript.full_text,
        language=transcript.language,
        word_count=transcript.word_count,
        created_at=transcript.created_at,
        segments=[s for s in segments],
    )


@router.get("/{episode_id}/analysis", response_model=EpisodeSummaryResponse)
def get_analysis(episode_id: int, db: Session = Depends(get_db)):
    """Get the AI analysis summary for an episode."""
    episode = db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    summary = (
        db.query(EpisodeSummary)
        .filter(EpisodeSummary.episode_id == episode_id)
        .first()
    )
    if not summary:
        raise HTTPException(status_code=404, detail="Analysis not available")

    return EpisodeSummaryResponse(
        id=summary.id,
        episode_id=summary.episode_id,
        one_line=summary.one_line,
        short_summary=summary.short_summary,
        detailed_summary=summary.detailed_summary,
        key_points=json.loads(summary.key_points),
        notable_quotes=json.loads(summary.notable_quotes) if summary.notable_quotes else [],
        created_at=summary.created_at,
    )


@router.get("/{episode_id}/suggest-topic")
def suggest_topic(episode_id: int, db: Session = Depends(get_db)):
    """Suggest a topic for an episode based on its description and podcast metadata.

    Returns either a matching existing topic or a suggested new topic name.
    """
    episode = db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    # Gather text to match against
    text_parts = []
    if episode.title:
        text_parts.append(episode.title)
    if episode.description:
        text_parts.append(episode.description)

    podcast = db.get(Podcast, episode.podcast_id) if episode.podcast_id else None
    podcast_title = ""
    if podcast:
        podcast_title = podcast.title or ""
        if podcast.title:
            text_parts.append(podcast.title)
        if podcast.description:
            text_parts.append(podcast.description)

    search_text = " ".join(text_parts).lower()

    # Try to match against existing topics
    topics = db.query(Topic).all()
    best_match = None
    best_score = 0

    for topic in topics:
        name_lower = topic.name.lower()
        # Check if the topic name appears in the episode/podcast text
        if name_lower in search_text:
            score = len(name_lower)  # longer matches are better
            if score > best_score:
                best_score = score
                best_match = topic

        # Also check individual words of multi-word topic names
        words = name_lower.split()
        if len(words) > 1:
            matching_words = sum(1 for w in words if w in search_text and len(w) > 3)
            word_score = matching_words * 2
            if word_score > best_score and matching_words >= len(words) // 2 + 1:
                best_score = word_score
                best_match = topic

    if best_match:
        return {
            "match": "existing",
            "topic_id": best_match.id,
            "topic_name": best_match.name,
        }

    # No match — use Claude to extract the topic from the episode content
    content_parts = []
    if episode.title:
        content_parts.append(f"Title: {episode.title}")
    if episode.description:
        content_parts.append(f"Description: {episode.description[:1000]}")
    content_text = "\n".join(content_parts)

    if content_text.strip():
        try:
            import anthropic
            from app.config import get_settings

            settings = get_settings()
            api_key = settings.ANTHROPIC_API_KEY
            if not api_key:
                # Fallback: read directly from .env if env var is empty
                from dotenv import dotenv_values
                env_vals = dotenv_values(settings.project_root / ".env")
                api_key = env_vals.get("ANTHROPIC_API_KEY", "")
            if api_key:
                client = anthropic.Anthropic(api_key=api_key)
                existing_names = [t.name for t in topics]
                existing_str = ", ".join(existing_names) if existing_names else "none yet"

                system_prompt = (
                    "You are a topic classifier. Reply with ONLY a 1-3 word topic label. "
                    "No explanation. No punctuation. No quotes. "
                    "Use a general subject area, not a person's name or a phrase from the title. "
                    "Examples: Design Tools, Machine Learning, Web Performance, Startup Culture."
                )

                user_prompt = content_text
                if existing_names:
                    user_prompt += (
                        f"\n\nExisting topics: {existing_str}\n"
                        f"If one of these fits, reply with that exact name."
                    )

                message = client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=20,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}],
                )

                suggested = message.content[0].text.strip().strip('"').strip("'")
                # Check if Claude suggested an existing topic
                for topic in topics:
                    if topic.name.lower() == suggested.lower():
                        return {
                            "match": "existing",
                            "topic_id": topic.id,
                            "topic_name": topic.name,
                        }

                if suggested and len(suggested) < 40:
                    return {
                        "match": "suggested",
                        "topic_id": None,
                        "topic_name": suggested,
                    }
        except Exception as e:
            logging.getLogger(__name__).warning("Topic suggestion failed: %s", e)

    return {
        "match": "none",
        "topic_id": None,
        "topic_name": None,
    }


@router.post("/{episode_id}/process", response_model=dict)
def process_episode(episode_id: int, db: Session = Depends(get_db)):
    """Manually trigger processing for an episode.

    Starts the pipeline: download -> transcribe -> analyze.
    Jumps to the appropriate step based on current status.
    """
    episode = db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    if episode.audio_status == "downloading":
        raise HTTPException(status_code=409, detail="Episode is already being downloaded")

    if episode.transcription_status == "processing":
        raise HTTPException(status_code=409, detail="Episode is already being transcribed")

    if episode.analysis_status == "processing":
        raise HTTPException(status_code=409, detail="Episode is already being analyzed")

    # Transcribed but not yet analyzed → start analysis only
    if episode.transcription_status == "completed" and episode.analysis_status in ("pending", "failed"):
        task_id = submit_task(
            analyze_episode,
            episode.id,
            retries=2,
            retry_delay=60,
            task_name="analyze_episode",
        )
        return {
            "message": "Episode queued for AI analysis",
            "episode_id": episode_id,
            "task_id": task_id,
        }

    # Audio downloaded but not yet transcribed → start transcription (chains to analysis)
    if episode.audio_status == "downloaded" and episode.transcription_status in ("pending", "failed"):
        task_id = submit_task(
            transcribe_episode,
            episode.id,
            retries=2,
            retry_delay=120,
            on_success=_chain_after_transcribe,
            task_name="transcribe_episode",
        )
        return {
            "message": "Episode queued for transcription",
            "episode_id": episode_id,
            "task_id": task_id,
        }

    # Already fully analyzed
    if episode.analysis_status == "completed":
        return {
            "message": "Episode already analyzed",
            "episode_id": episode_id,
            "analysis_status": episode.analysis_status,
        }

    # Already fully transcribed (but analysis not pending — edge case)
    if episode.transcription_status == "completed":
        return {
            "message": "Episode already transcribed",
            "episode_id": episode_id,
            "transcription_status": episode.transcription_status,
        }

    # Not yet downloaded → start full pipeline: download -> transcribe -> analyze
    episode.audio_status = "downloading"
    db.commit()

    task_id = queue_episode_pipeline(episode.id)

    return {
        "message": "Episode queued for processing",
        "episode_id": episode_id,
        "task_id": task_id,
    }


@router.post("/{episode_id}/trash", response_model=dict)
def trash_episode(episode_id: int, db: Session = Depends(get_db)):
    """Move an episode to trash."""
    episode = db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    episode.trashed_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Episode trashed", "episode_id": episode_id}


@router.post("/{episode_id}/restore", response_model=dict)
def restore_episode(episode_id: int, db: Session = Depends(get_db)):
    """Restore an episode from trash."""
    episode = db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    episode.trashed_at = None
    db.commit()
    return {"message": "Episode restored", "episode_id": episode_id}
