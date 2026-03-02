from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl

from app.schemas.topic import TopicResponse


class PodcastCreate(BaseModel):
    feed_url: str = Field(..., min_length=1)
    topic_id: int


class PodcastResponse(BaseModel):
    id: int
    title: str
    feed_url: str
    description: str | None
    author: str | None
    image_url: str | None
    topic: TopicResponse
    episode_count: int = 0
    last_fetched_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PodcastListItem(BaseModel):
    id: int
    title: str
    feed_url: str
    description: str | None
    author: str | None
    image_url: str | None
    topic_id: int
    episode_count: int = 0
    last_fetched_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
