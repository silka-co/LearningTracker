"""Podcast feed management endpoints."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import get_settings
from app.models.topic import Topic
from app.models.podcast import Podcast
from app.models.episode import Episode
from app.schemas.podcast import PodcastCreate, PodcastResponse, PodcastListItem
from app.schemas.topic import TopicResponse
from app.services.feed_parser import FeedParserService, FeedParseError
from app.tasks.download_tasks import queue_recent_episodes, queue_new_episodes

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("", response_model=PodcastResponse, status_code=201)
def add_podcast(data: PodcastCreate, db: Session = Depends(get_db)):
    """Add a new podcast by RSS feed URL.

    Parses the feed, creates the podcast and all episodes,
    then auto-queues the most recent episodes for download.
    """
    settings = get_settings()

    # Check for duplicate feed URL
    existing = db.query(Podcast).filter(Podcast.feed_url == data.feed_url).first()
    if existing:
        raise HTTPException(status_code=409, detail="This feed URL is already added")

    # Verify topic exists
    topic = db.get(Topic, data.topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Parse the feed
    parser = FeedParserService()
    try:
        parsed = parser.parse_feed(data.feed_url)
    except FeedParseError as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse feed: {e}")

    # Create podcast record
    podcast = Podcast(
        topic_id=data.topic_id,
        title=parsed.title,
        feed_url=data.feed_url,
        description=parsed.description,
        author=parsed.author,
        image_url=parsed.image_url,
        last_fetched_at=datetime.now(timezone.utc),
    )
    db.add(podcast)
    db.flush()  # Get podcast.id without committing

    # Create episode records
    for ep in parsed.episodes:
        episode = Episode(
            podcast_id=podcast.id,
            guid=ep.guid,
            title=ep.title,
            description=ep.description,
            audio_url=ep.audio_url,
            published_at=ep.published_at,
            duration_seconds=ep.duration_seconds,
        )
        db.add(episode)

    db.commit()
    db.refresh(podcast)

    logger.info(
        "Added podcast '%s' with %d episodes (topic: %s)",
        podcast.title,
        len(parsed.episodes),
        topic.name,
    )

    # Auto-queue the most recent episodes for download
    try:
        queue_recent_episodes(podcast.id, count=settings.AUTO_DOWNLOAD_RECENT)
    except Exception as e:
        logger.warning("Failed to queue downloads for podcast %d: %s", podcast.id, e)

    return _podcast_to_response(podcast, db)


@router.get("", response_model=list[PodcastListItem])
def list_podcasts(
    topic_id: int | None = Query(None, description="Filter by topic"),
    db: Session = Depends(get_db),
):
    """List all podcasts, optionally filtered by topic."""
    query = db.query(Podcast)
    if topic_id is not None:
        query = query.filter(Podcast.topic_id == topic_id)
    podcasts = query.order_by(Podcast.title).all()
    return [_podcast_to_list_item(p, db) for p in podcasts]


@router.get("/{podcast_id}", response_model=PodcastResponse)
def get_podcast(podcast_id: int, db: Session = Depends(get_db)):
    """Get a podcast with full details."""
    podcast = db.get(Podcast, podcast_id)
    if not podcast:
        raise HTTPException(status_code=404, detail="Podcast not found")
    return _podcast_to_response(podcast, db)


@router.post("/{podcast_id}/refresh", response_model=PodcastResponse)
def refresh_podcast(podcast_id: int, db: Session = Depends(get_db)):
    """Re-fetch the podcast feed and discover new episodes.

    New episodes are automatically queued for download.
    """
    podcast = db.get(Podcast, podcast_id)
    if not podcast:
        raise HTTPException(status_code=404, detail="Podcast not found")

    # Parse the feed
    parser = FeedParserService()
    try:
        parsed = parser.parse_feed(podcast.feed_url)
    except FeedParseError as e:
        raise HTTPException(status_code=422, detail=f"Failed to refresh feed: {e}")

    # Find existing GUIDs to avoid duplicates
    existing_guids = set(
        row[0]
        for row in db.query(Episode.guid).filter(Episode.podcast_id == podcast_id).all()
    )

    # Add new episodes
    new_count = 0
    for ep in parsed.episodes:
        if ep.guid not in existing_guids:
            episode = Episode(
                podcast_id=podcast.id,
                guid=ep.guid,
                title=ep.title,
                description=ep.description,
                audio_url=ep.audio_url,
                published_at=ep.published_at,
                duration_seconds=ep.duration_seconds,
            )
            db.add(episode)
            new_count += 1

    podcast.last_fetched_at = datetime.now(timezone.utc)

    # Update podcast metadata if it changed
    if parsed.title:
        podcast.title = parsed.title
    if parsed.description:
        podcast.description = parsed.description
    if parsed.author:
        podcast.author = parsed.author
    if parsed.image_url:
        podcast.image_url = parsed.image_url

    db.commit()
    db.refresh(podcast)

    logger.info("Refreshed podcast '%s': %d new episodes", podcast.title, new_count)

    # Auto-queue new episodes for download
    if new_count > 0:
        try:
            queue_new_episodes(podcast.id)
        except Exception as e:
            logger.warning("Failed to queue new episode downloads: %s", e)

    return _podcast_to_response(podcast, db)


@router.delete("/{podcast_id}", status_code=204)
def delete_podcast(podcast_id: int, db: Session = Depends(get_db)):
    """Delete a podcast and all its episodes."""
    podcast = db.get(Podcast, podcast_id)
    if not podcast:
        raise HTTPException(status_code=404, detail="Podcast not found")

    db.delete(podcast)
    db.commit()


def _podcast_to_response(podcast: Podcast, db: Session) -> PodcastResponse:
    episode_count = (
        db.query(func.count(Episode.id))
        .filter(Episode.podcast_id == podcast.id)
        .scalar()
    )
    topic = db.get(Topic, podcast.topic_id)
    return PodcastResponse(
        id=podcast.id,
        title=podcast.title,
        feed_url=podcast.feed_url,
        description=podcast.description,
        author=podcast.author,
        image_url=podcast.image_url,
        topic=TopicResponse(
            id=topic.id,
            name=topic.name,
            description=topic.description,
            color=topic.color,
            created_at=topic.created_at,
            podcast_count=0,
        ),
        episode_count=episode_count,
        last_fetched_at=podcast.last_fetched_at,
        created_at=podcast.created_at,
    )


def _podcast_to_list_item(podcast: Podcast, db: Session) -> PodcastListItem:
    episode_count = (
        db.query(func.count(Episode.id))
        .filter(Episode.podcast_id == podcast.id)
        .scalar()
    )
    return PodcastListItem(
        id=podcast.id,
        title=podcast.title,
        feed_url=podcast.feed_url,
        description=podcast.description,
        author=podcast.author,
        image_url=podcast.image_url,
        topic_id=podcast.topic_id,
        episode_count=episode_count,
        last_fetched_at=podcast.last_fetched_at,
        created_at=podcast.created_at,
    )
