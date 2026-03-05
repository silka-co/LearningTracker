"""Pydantic schemas for Q&A chat."""

import json
from datetime import datetime

from pydantic import BaseModel, field_validator


class QAMessageRequest(BaseModel):
    content: str


class QAMessageResponse(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    follow_up_questions: list[str] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("follow_up_questions", mode="before")
    @classmethod
    def parse_follow_ups(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return None
        return v


class QASessionResponse(BaseModel):
    id: int
    episode_id: int | None
    topic_id: int | None
    title: str | None
    created_at: datetime
    messages: list[QAMessageResponse]

    model_config = {"from_attributes": True}


class ChatListItem(BaseModel):
    """Summary of a chat session for the chats list page."""
    id: int
    first_question: str
    last_message_at: datetime
    context_type: str  # "episode", "topic", or "dashboard"
    episode_id: int | None = None
    topic_id: int | None = None
    topic_name: str | None = None
    episode_title: str | None = None
    podcast_title: str | None = None
    message_count: int


class ChatDetailResponse(BaseModel):
    """Full chat session with messages and context for the chat detail page."""
    id: int
    episode_id: int | None
    topic_id: int | None
    context_type: str
    topic_name: str | None = None
    episode_title: str | None = None
    podcast_title: str | None = None
    source_episode_count: int = 0
    created_at: datetime
    messages: list[QAMessageResponse]
