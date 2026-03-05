"""Podcast feed management endpoints."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import get_settings
from app.models.podcast import Podcast
from app.models.episode import Episode
from app.schemas.podcast import PodcastCreate, PodcastResponse, PodcastListItem
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

    # Parse the feed
    parser = FeedParserService()
    try:
        parsed = parser.parse_feed(data.feed_url)
    except FeedParseError as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse feed: {e}")

    # Create podcast record
    podcast = Podcast(
        title=parsed.title,
        feed_url=data.feed_url,
        description=parsed.description,
        author=parsed.author,
        image_url=parsed.image_url,
        last_fetched_at=datetime.now(timezone.utc),
    )
    db.add(podcast)
    db.flush()  # Get podcast.id without committing

    # Create episode records (no topic — topics are assigned per-episode)
    # Re-attach any detached episodes (from a previous unfollow) instead of duplicating
    detached_guids = {
        row[0]: row[1]
        for row in db.query(Episode.guid, Episode.id)
        .filter(Episode.podcast_id.is_(None), Episode.guid.in_([ep.guid for ep in parsed.episodes]))
        .all()
    }

    for ep in parsed.episodes:
        if ep.guid in detached_guids:
            # Re-attach the previously detached episode
            db.query(Episode).filter(Episode.id == detached_guids[ep.guid]).update(
                {Episode.podcast_id: podcast.id}
            )
        else:
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
        "Added podcast '%s' with %d episodes",
        podcast.title,
        len(parsed.episodes),
    )

    # Auto-queue the most recent episodes for download
    try:
        queue_recent_episodes(podcast.id, count=settings.AUTO_DOWNLOAD_RECENT)
    except Exception as e:
        logger.warning("Failed to queue downloads for podcast %d: %s", podcast.id, e)

    return _podcast_to_response(podcast, db)


@router.get("", response_model=list[PodcastListItem])
def list_podcasts(db: Session = Depends(get_db)):
    """List all podcasts."""
    podcasts = db.query(Podcast).order_by(Podcast.title).all()
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

    # Find detached episodes (from a previous unfollow) that can be re-attached
    feed_guids = [ep.guid for ep in parsed.episodes]
    detached_guids = {
        row[0]: row[1]
        for row in db.query(Episode.guid, Episode.id)
        .filter(Episode.podcast_id.is_(None), Episode.guid.in_(feed_guids))
        .all()
    }

    # Add new episodes (no topic — topics are assigned per-episode)
    new_count = 0
    for ep in parsed.episodes:
        if ep.guid in existing_guids:
            continue
        if ep.guid in detached_guids:
            # Re-attach the previously detached episode
            db.query(Episode).filter(Episode.id == detached_guids[ep.guid]).update(
                {Episode.podcast_id: podcast.id}
            )
            new_count += 1
        else:
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


@router.post("/refresh-stale", response_model=dict)
def refresh_stale_podcasts(db: Session = Depends(get_db)):
    """Refresh all podcast feeds that haven't been checked in 24 hours.

    Called on page load to keep episodes up to date.
    Returns the count of refreshed podcasts and new episodes found.
    """
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    stale_podcasts = (
        db.query(Podcast)
        .filter(
            (Podcast.last_fetched_at.is_(None)) | (Podcast.last_fetched_at < cutoff)
        )
        .all()
    )

    if not stale_podcasts:
        return {"refreshed": 0, "new_episodes": 0}

    parser = FeedParserService()
    total_new = 0

    for podcast in stale_podcasts:
        try:
            parsed = parser.parse_feed(podcast.feed_url)
        except FeedParseError as e:
            logger.warning("Failed to refresh feed for '%s': %s", podcast.title, e)
            continue

        existing_guids = set(
            row[0]
            for row in db.query(Episode.guid).filter(Episode.podcast_id == podcast.id).all()
        )

        # Find detached episodes that can be re-attached
        feed_guids = [ep.guid for ep in parsed.episodes]
        detached_guids = {
            row[0]: row[1]
            for row in db.query(Episode.guid, Episode.id)
            .filter(Episode.podcast_id.is_(None), Episode.guid.in_(feed_guids))
            .all()
        }

        new_count = 0
        for ep in parsed.episodes:
            if ep.guid in existing_guids:
                continue
            if ep.guid in detached_guids:
                db.query(Episode).filter(Episode.id == detached_guids[ep.guid]).update(
                    {Episode.podcast_id: podcast.id}
                )
                new_count += 1
            else:
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

        if parsed.title:
            podcast.title = parsed.title
        if parsed.description:
            podcast.description = parsed.description
        if parsed.author:
            podcast.author = parsed.author
        if parsed.image_url:
            podcast.image_url = parsed.image_url

        db.commit()
        total_new += new_count

        if new_count > 0:
            logger.info("Refreshed '%s': %d new episodes", podcast.title, new_count)
            try:
                queue_new_episodes(podcast.id)
            except Exception as e:
                logger.warning("Failed to queue new episode downloads: %s", e)

    return {"refreshed": len(stale_podcasts), "new_episodes": total_new}


@router.post("/refresh-all", response_model=dict)
def refresh_all_podcasts(db: Session = Depends(get_db)):
    """Refresh all podcast feeds regardless of when they were last checked.

    Manually triggered by the user to check for new episodes across all podcasts.
    Returns the count of refreshed podcasts and new episodes found.
    """
    all_podcasts = db.query(Podcast).all()

    if not all_podcasts:
        return {"refreshed": 0, "new_episodes": 0}

    parser = FeedParserService()
    total_new = 0

    for podcast in all_podcasts:
        try:
            parsed = parser.parse_feed(podcast.feed_url)
        except FeedParseError as e:
            logger.warning("Failed to refresh feed for '%s': %s", podcast.title, e)
            continue

        existing_guids = set(
            row[0]
            for row in db.query(Episode.guid).filter(Episode.podcast_id == podcast.id).all()
        )

        # Find detached episodes that can be re-attached
        feed_guids = [ep.guid for ep in parsed.episodes]
        detached_guids = {
            row[0]: row[1]
            for row in db.query(Episode.guid, Episode.id)
            .filter(Episode.podcast_id.is_(None), Episode.guid.in_(feed_guids))
            .all()
        }

        new_count = 0
        for ep in parsed.episodes:
            if ep.guid in existing_guids:
                continue
            if ep.guid in detached_guids:
                db.query(Episode).filter(Episode.id == detached_guids[ep.guid]).update(
                    {Episode.podcast_id: podcast.id}
                )
                new_count += 1
            else:
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

        if parsed.title:
            podcast.title = parsed.title
        if parsed.description:
            podcast.description = parsed.description
        if parsed.author:
            podcast.author = parsed.author
        if parsed.image_url:
            podcast.image_url = parsed.image_url

        db.commit()
        total_new += new_count

        if new_count > 0:
            logger.info("Refreshed '%s': %d new episodes", podcast.title, new_count)
            try:
                queue_new_episodes(podcast.id)
            except Exception as e:
                logger.warning("Failed to queue new episode downloads: %s", e)

    return {"refreshed": len(all_podcasts), "new_episodes": total_new}


@router.post("/{podcast_id}/unfollow", response_model=dict)
def unfollow_podcast(podcast_id: int, db: Session = Depends(get_db)):
    """Unfollow a podcast: delete the podcast but keep processed episodes.

    Episodes that have been fully processed (analysis completed) are kept
    with their podcast_id set to NULL. Unprocessed episodes are deleted.
    """
    podcast = db.get(Podcast, podcast_id)
    if not podcast:
        raise HTTPException(status_code=404, detail="Podcast not found")

    # Detach processed episodes (set podcast_id to NULL) so they survive deletion
    kept_count = (
        db.query(Episode)
        .filter(
            Episode.podcast_id == podcast_id,
            Episode.analysis_status == "completed",
        )
        .update({Episode.podcast_id: None})
    )
    db.flush()

    # Delete unprocessed episodes still linked to this podcast
    db.query(Episode).filter(Episode.podcast_id == podcast_id).delete()

    # Now delete the podcast itself
    db.delete(podcast)
    db.commit()

    return {"message": "Unfollowed podcast", "kept_episodes": kept_count}


@router.delete("/{podcast_id}", status_code=204)
def delete_podcast(podcast_id: int, db: Session = Depends(get_db)):
    """Delete a podcast and all its episodes."""
    podcast = db.get(Podcast, podcast_id)
    if not podcast:
        raise HTTPException(status_code=404, detail="Podcast not found")

    db.query(Episode).filter(Episode.podcast_id == podcast_id).delete()
    db.delete(podcast)
    db.commit()


def _podcast_to_response(podcast: Podcast, db: Session) -> PodcastResponse:
    episode_count = (
        db.query(func.count(Episode.id))
        .filter(Episode.podcast_id == podcast.id, Episode.transcription_status == "completed")
        .scalar()
    )
    total_episode_count = (
        db.query(func.count(Episode.id))
        .filter(Episode.podcast_id == podcast.id)
        .scalar()
    )
    return PodcastResponse(
        id=podcast.id,
        title=podcast.title,
        feed_url=podcast.feed_url,
        description=podcast.description,
        author=podcast.author,
        image_url=podcast.image_url,
        episode_count=episode_count,
        total_episode_count=total_episode_count,
        last_fetched_at=podcast.last_fetched_at,
        created_at=podcast.created_at,
    )


def _podcast_to_list_item(podcast: Podcast, db: Session) -> PodcastListItem:
    episode_count = (
        db.query(func.count(Episode.id))
        .filter(Episode.podcast_id == podcast.id, Episode.transcription_status == "completed")
        .scalar()
    )
    total_episode_count = (
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
        episode_count=episode_count,
        total_episode_count=total_episode_count,
        last_fetched_at=podcast.last_fetched_at,
        created_at=podcast.created_at,
    )
