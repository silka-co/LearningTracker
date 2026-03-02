from datetime import datetime

from pydantic import BaseModel, Field


class TopicCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    color: str = "#6366f1"


class TopicUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    color: str | None = None


class TopicResponse(BaseModel):
    id: int
    name: str
    description: str | None
    color: str
    created_at: datetime
    podcast_count: int = 0

    model_config = {"from_attributes": True}
