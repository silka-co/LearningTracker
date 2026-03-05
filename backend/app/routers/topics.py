"""Topic management endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.topic import Topic
from app.models.episode import Episode, episode_topics
from app.schemas.topic import TopicCreate, TopicUpdate, TopicResponse

router = APIRouter()


@router.post("", response_model=TopicResponse, status_code=201)
def create_topic(data: TopicCreate, db: Session = Depends(get_db)):
    """Create a new topic for organizing episodes."""
    existing = db.query(Topic).filter(Topic.name == data.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Topic '{data.name}' already exists")

    topic = Topic(name=data.name, description=data.description, color=data.color)
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return _topic_to_response(topic, db)


@router.get("", response_model=list[TopicResponse])
def list_topics(db: Session = Depends(get_db)):
    """List all topics with episode counts."""
    topics = db.query(Topic).order_by(Topic.name).all()
    return [_topic_to_response(t, db) for t in topics]


@router.get("/{topic_id}", response_model=TopicResponse)
def get_topic(topic_id: int, db: Session = Depends(get_db)):
    """Get a single topic by ID."""
    topic = db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return _topic_to_response(topic, db)


@router.put("/{topic_id}", response_model=TopicResponse)
def update_topic(topic_id: int, data: TopicUpdate, db: Session = Depends(get_db)):
    """Update a topic's name, description, or color."""
    topic = db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    if data.name is not None:
        # Check for name conflict
        conflict = db.query(Topic).filter(Topic.name == data.name, Topic.id != topic_id).first()
        if conflict:
            raise HTTPException(status_code=409, detail=f"Topic '{data.name}' already exists")
        topic.name = data.name
    if data.description is not None:
        topic.description = data.description
    if data.color is not None:
        topic.color = data.color

    db.commit()
    db.refresh(topic)
    return _topic_to_response(topic, db)


@router.delete("/{topic_id}", status_code=204)
def delete_topic(topic_id: int, db: Session = Depends(get_db)):
    """Delete a topic. Unassigns episodes first."""
    topic = db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Remove junction table entries for this topic
    db.execute(episode_topics.delete().where(episode_topics.c.topic_id == topic_id))

    # Clear legacy topic_id references
    db.query(Episode).filter(Episode.topic_id == topic_id).update(
        {Episode.topic_id: None}
    )

    db.delete(topic)
    db.commit()


def _topic_to_response(topic: Topic, db: Session) -> TopicResponse:
    episode_count = (
        db.query(func.count(episode_topics.c.episode_id))
        .join(Episode, Episode.id == episode_topics.c.episode_id)
        .filter(
            episode_topics.c.topic_id == topic.id,
            Episode.trashed_at.is_(None),
        )
        .scalar()
    )
    return TopicResponse(
        id=topic.id,
        name=topic.name,
        description=topic.description,
        color=topic.color,
        created_at=topic.created_at,
        episode_count=episode_count,
    )
