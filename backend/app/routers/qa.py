"""Q&A chat endpoints for episode-level and dashboard-level conversations."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.episode import Episode, EpisodeSummary, Transcript
from app.models.podcast import Podcast
from app.models.topic import Topic
from app.models.qa import QASession, QAMessage
from app.schemas.qa import QAMessageRequest, QAMessageResponse, QASessionResponse, ChatListItem, ChatDetailResponse
from app.services.qa_service import QAService

logger = logging.getLogger(__name__)

router = APIRouter()


# ── List all chat sessions ────────────────────────────────────────


@router.get("/chats", response_model=list[ChatListItem])
def list_chats(
    search: str | None = Query(None, description="Search messages"),
    topic_id: int | None = Query(None, description="Filter by topic"),
    episode_id: int | None = Query(None, description="Filter by episode"),
    db: Session = Depends(get_db),
):
    """List all chat sessions, ordered by most recent message first."""
    from sqlalchemy import func

    query = db.query(QASession)

    # Filter by topic: include topic-level chats AND episode-level chats
    # where the episode belongs to the topic
    if topic_id:
        topic_session_ids = (
            db.query(QASession.id)
            .filter(QASession.topic_id == topic_id)
        )
        episode_session_ids = (
            db.query(QASession.id)
            .join(Episode, QASession.episode_id == Episode.id)
            .filter(Episode.topics.any(Topic.id == topic_id))
        )
        query = query.filter(
            QASession.id.in_(topic_session_ids.union(episode_session_ids))
        )

    # Filter by episode
    if episode_id:
        query = query.filter(QASession.episode_id == episode_id)

    # If searching, filter to sessions containing matching messages
    if search:
        matching_session_ids = (
            db.query(QAMessage.session_id)
            .filter(QAMessage.content.ilike(f"%{search}%"))
            .distinct()
            .subquery()
        )
        query = query.filter(QASession.id.in_(db.query(matching_session_ids)))

    sessions = query.all()

    items = []
    for session in sessions:
        messages = (
            db.query(QAMessage)
            .filter(QAMessage.session_id == session.id)
            .order_by(QAMessage.created_at)
            .all()
        )
        if not messages:
            continue  # Skip empty sessions

        # Find first user message as the question
        first_question = next(
            (m.content for m in messages if m.role == "user"),
            "Untitled chat",
        )
        last_message_at = messages[-1].created_at

        # Determine context
        context_type = "dashboard"
        topic_name = None
        episode_title = None
        podcast_title = None

        if session.episode_id:
            context_type = "episode"
            episode = db.get(Episode, session.episode_id)
            if episode:
                episode_title = episode.title
                podcast = db.get(Podcast, episode.podcast_id) if episode.podcast_id else None
                if podcast:
                    podcast_title = podcast.title
        elif session.topic_id:
            context_type = "topic"
            topic = db.get(Topic, session.topic_id)
            if topic:
                topic_name = topic.name

        items.append(ChatListItem(
            id=session.id,
            first_question=first_question,
            last_message_at=last_message_at,
            context_type=context_type,
            episode_id=session.episode_id,
            topic_id=session.topic_id,
            topic_name=topic_name,
            episode_title=episode_title,
            podcast_title=podcast_title,
            message_count=len(messages),
        ))

    # Sort by most recent message first
    items.sort(key=lambda x: x.last_message_at, reverse=True)
    return items


@router.get("/chats/{session_id}", response_model=ChatDetailResponse)
def get_chat_detail(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get a single chat session with full messages and context."""
    session = db.get(QASession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = (
        db.query(QAMessage)
        .filter(QAMessage.session_id == session.id)
        .order_by(QAMessage.created_at)
        .all()
    )

    # Determine context
    context_type = "dashboard"
    topic_name = None
    episode_title = None
    podcast_title = None
    source_episode_count = 0

    if session.episode_id:
        context_type = "episode"
        source_episode_count = 1
        episode = db.get(Episode, session.episode_id)
        if episode:
            episode_title = episode.title
            podcast = db.get(Podcast, episode.podcast_id) if episode.podcast_id else None
            if podcast:
                podcast_title = podcast.title
    elif session.topic_id:
        context_type = "topic"
        topic = db.get(Topic, session.topic_id)
        if topic:
            topic_name = topic.name
        # Count analyzed episodes in this topic
        source_episode_count = (
            db.query(Episode)
            .filter(Episode.topics.any(Topic.id == session.topic_id), Episode.analysis_status == "completed")
            .count()
        )
    else:
        # Dashboard: count all analyzed episodes
        source_episode_count = (
            db.query(Episode)
            .filter(Episode.analysis_status == "completed")
            .count()
        )

    return ChatDetailResponse(
        id=session.id,
        episode_id=session.episode_id,
        topic_id=session.topic_id,
        context_type=context_type,
        topic_name=topic_name,
        episode_title=episode_title,
        podcast_title=podcast_title,
        source_episode_count=source_episode_count,
        created_at=session.created_at,
        messages=[QAMessageResponse.model_validate(m) for m in messages],
    )


def _get_qa_service() -> QAService:
    settings = get_settings()
    return QAService(api_key=settings.ANTHROPIC_API_KEY)


# ── Episode-level chat ────────────────────────────────────────────


@router.post(
    "/episodes/{episode_id}/chat",
    response_model=QAMessageResponse,
)
def episode_chat(
    episode_id: int,
    body: QAMessageRequest,
    db: Session = Depends(get_db),
):
    """Send a message in episode-level Q&A. Creates session if needed."""
    episode = db.get(Episode, episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    if episode.analysis_status != "completed":
        raise HTTPException(
            status_code=400,
            detail="Episode must be fully analyzed before Q&A",
        )

    # Get or create session for this episode
    session = (
        db.query(QASession)
        .filter(QASession.episode_id == episode_id)
        .first()
    )
    if not session:
        session = QASession(episode_id=episode_id, title=episode.title)
        db.add(session)
        db.flush()

    # Build history from existing messages
    existing = (
        db.query(QAMessage)
        .filter(QAMessage.session_id == session.id)
        .order_by(QAMessage.created_at)
        .all()
    )
    history = [{"role": m.role, "content": m.content} for m in existing]

    # Fetch context
    transcript = (
        db.query(Transcript)
        .filter(Transcript.episode_id == episode_id)
        .first()
    )
    summary_row = (
        db.query(EpisodeSummary)
        .filter(EpisodeSummary.episode_id == episode_id)
        .first()
    )

    transcript_text = transcript.full_text if transcript else None
    summary_text = summary_row.short_summary if summary_row else None

    # Call Claude
    service = _get_qa_service()
    result = service.ask(
        question=body.content,
        history=history,
        transcript_text=transcript_text,
        summary=summary_text,
        episode_title=episode.title,
    )

    # Save both messages
    follow_ups_json = json.dumps(result["follow_up_questions"]) if result["follow_up_questions"] else None
    user_msg = QAMessage(session_id=session.id, role="user", content=body.content)
    assistant_msg = QAMessage(session_id=session.id, role="assistant", content=result["answer"], follow_up_questions=follow_ups_json)
    db.add(user_msg)
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    return QAMessageResponse.model_validate(assistant_msg)


@router.get(
    "/episodes/{episode_id}/chat",
    response_model=QASessionResponse | None,
)
def episode_chat_history(
    episode_id: int,
    db: Session = Depends(get_db),
):
    """Get chat history for an episode."""
    session = (
        db.query(QASession)
        .filter(QASession.episode_id == episode_id)
        .first()
    )
    if not session:
        return None

    messages = (
        db.query(QAMessage)
        .filter(QAMessage.session_id == session.id)
        .order_by(QAMessage.created_at)
        .all()
    )

    return QASessionResponse(
        id=session.id,
        episode_id=session.episode_id,
        topic_id=session.topic_id,
        title=session.title,
        created_at=session.created_at,
        messages=[QAMessageResponse.model_validate(m) for m in messages],
    )


@router.delete("/episodes/{episode_id}/chat")
def episode_chat_clear(
    episode_id: int,
    db: Session = Depends(get_db),
):
    """Clear chat history for an episode."""
    session = (
        db.query(QASession)
        .filter(QASession.episode_id == episode_id)
        .first()
    )
    if session:
        db.query(QAMessage).filter(QAMessage.session_id == session.id).delete()
        db.delete(session)
        db.commit()

    return {"message": "Chat cleared"}


# ── Dashboard-level chat ──────────────────────────────────────────


@router.post("/chat", response_model=QAMessageResponse)
def dashboard_chat(
    body: QAMessageRequest,
    db: Session = Depends(get_db),
):
    """Send a message in dashboard-level Q&A (across all episodes)."""
    # Get or create a global session (no episode_id, no topic_id)
    session = (
        db.query(QASession)
        .filter(
            QASession.episode_id.is_(None),
            QASession.topic_id.is_(None),
        )
        .first()
    )
    if not session:
        session = QASession(title="Dashboard Q&A")
        db.add(session)
        db.flush()

    # Build history
    existing = (
        db.query(QAMessage)
        .filter(QAMessage.session_id == session.id)
        .order_by(QAMessage.created_at)
        .all()
    )
    history = [{"role": m.role, "content": m.content} for m in existing]

    # Gather transcripts and summaries from all analyzed episodes
    all_episodes = (
        db.query(Episode)
        .filter(Episode.analysis_status == "completed")
        .order_by(Episode.published_at.desc())
        .limit(20)
        .all()
    )

    episode_contexts = []
    for ep in all_episodes:
        transcript = (
            db.query(Transcript)
            .filter(Transcript.episode_id == ep.id)
            .first()
        )
        summary_row = (
            db.query(EpisodeSummary)
            .filter(EpisodeSummary.episode_id == ep.id)
            .first()
        )
        episode_contexts.append({
            "title": ep.title,
            "summary": summary_row.short_summary if summary_row else None,
            "transcript": transcript.full_text if transcript else None,
        })

    # Call Claude
    service = _get_qa_service()
    result = service.ask(
        question=body.content,
        history=history,
        episode_contexts=episode_contexts if episode_contexts else None,
    )

    # Save messages
    follow_ups_json = json.dumps(result["follow_up_questions"]) if result["follow_up_questions"] else None
    user_msg = QAMessage(session_id=session.id, role="user", content=body.content)
    assistant_msg = QAMessage(session_id=session.id, role="assistant", content=result["answer"], follow_up_questions=follow_ups_json)
    db.add(user_msg)
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    return QAMessageResponse.model_validate(assistant_msg)


@router.get("/chat", response_model=QASessionResponse | None)
def dashboard_chat_history(db: Session = Depends(get_db)):
    """Get dashboard-level chat history."""
    session = (
        db.query(QASession)
        .filter(
            QASession.episode_id.is_(None),
            QASession.topic_id.is_(None),
        )
        .first()
    )
    if not session:
        return None

    messages = (
        db.query(QAMessage)
        .filter(QAMessage.session_id == session.id)
        .order_by(QAMessage.created_at)
        .all()
    )

    return QASessionResponse(
        id=session.id,
        episode_id=session.episode_id,
        topic_id=session.topic_id,
        title=session.title,
        created_at=session.created_at,
        messages=[QAMessageResponse.model_validate(m) for m in messages],
    )


@router.delete("/chat")
def dashboard_chat_clear(db: Session = Depends(get_db)):
    """Clear dashboard-level chat history."""
    session = (
        db.query(QASession)
        .filter(
            QASession.episode_id.is_(None),
            QASession.topic_id.is_(None),
        )
        .first()
    )
    if session:
        db.query(QAMessage).filter(QAMessage.session_id == session.id).delete()
        db.delete(session)
        db.commit()

    return {"message": "Chat cleared"}


# ── Topic-level chat ─────────────────────────────────────────────


@router.post("/topics/{topic_id}/chat", response_model=QAMessageResponse)
def topic_chat(
    topic_id: int,
    body: QAMessageRequest,
    db: Session = Depends(get_db),
):
    """Send a message in topic-level Q&A (across all episodes in a topic)."""
    topic = db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Get or create session for this topic
    session = (
        db.query(QASession)
        .filter(
            QASession.topic_id == topic_id,
            QASession.episode_id.is_(None),
        )
        .first()
    )
    if not session:
        session = QASession(topic_id=topic_id, title=f"{topic.name} Q&A")
        db.add(session)
        db.flush()

    # Build history
    existing = (
        db.query(QAMessage)
        .filter(QAMessage.session_id == session.id)
        .order_by(QAMessage.created_at)
        .all()
    )
    history = [{"role": m.role, "content": m.content} for m in existing]

    # Gather transcripts and summaries from analyzed episodes in this topic
    topic_episodes = (
        db.query(Episode)
        .filter(Episode.topics.any(Topic.id == topic_id), Episode.analysis_status == "completed")
        .order_by(Episode.published_at.desc())
        .limit(20)
        .all()
    )

    episode_contexts = []
    for ep in topic_episodes:
        transcript = (
            db.query(Transcript)
            .filter(Transcript.episode_id == ep.id)
            .first()
        )
        summary_row = (
            db.query(EpisodeSummary)
            .filter(EpisodeSummary.episode_id == ep.id)
            .first()
        )
        episode_contexts.append({
            "title": ep.title,
            "summary": summary_row.short_summary if summary_row else None,
            "transcript": transcript.full_text if transcript else None,
        })

    # Call Claude
    service = _get_qa_service()
    result = service.ask(
        question=body.content,
        history=history,
        episode_contexts=episode_contexts if episode_contexts else None,
    )

    # Save messages
    follow_ups_json = json.dumps(result["follow_up_questions"]) if result["follow_up_questions"] else None
    user_msg = QAMessage(session_id=session.id, role="user", content=body.content)
    assistant_msg = QAMessage(session_id=session.id, role="assistant", content=result["answer"], follow_up_questions=follow_ups_json)
    db.add(user_msg)
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    return QAMessageResponse.model_validate(assistant_msg)


@router.get("/topics/{topic_id}/chat", response_model=QASessionResponse | None)
def topic_chat_history(topic_id: int, db: Session = Depends(get_db)):
    """Get chat history for a topic."""
    session = (
        db.query(QASession)
        .filter(
            QASession.topic_id == topic_id,
            QASession.episode_id.is_(None),
        )
        .first()
    )
    if not session:
        return None

    messages = (
        db.query(QAMessage)
        .filter(QAMessage.session_id == session.id)
        .order_by(QAMessage.created_at)
        .all()
    )

    return QASessionResponse(
        id=session.id,
        episode_id=session.episode_id,
        topic_id=session.topic_id,
        title=session.title,
        created_at=session.created_at,
        messages=[QAMessageResponse.model_validate(m) for m in messages],
    )


@router.delete("/topics/{topic_id}/chat")
def topic_chat_clear(topic_id: int, db: Session = Depends(get_db)):
    """Clear chat history for a topic."""
    session = (
        db.query(QASession)
        .filter(
            QASession.topic_id == topic_id,
            QASession.episode_id.is_(None),
        )
        .first()
    )
    if session:
        db.query(QAMessage).filter(QAMessage.session_id == session.id).delete()
        db.delete(session)
        db.commit()

    return {"message": "Chat cleared"}
