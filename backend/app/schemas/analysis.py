"""Pydantic schemas for AI analysis API responses."""

from datetime import datetime

from pydantic import BaseModel


class EpisodeSummaryResponse(BaseModel):
    id: int
    episode_id: int
    one_line: str
    short_summary: str
    detailed_summary: str
    key_points: list[str]
    notable_quotes: list[dict]
    created_at: datetime

    model_config = {"from_attributes": True}


class InsightTopic(BaseModel):
    id: int
    name: str
    color: str


class InsightItem(BaseModel):
    episode_id: int
    episode_title: str
    podcast_title: str | None
    published_at: datetime | None
    short_summary: str
    analyzed_at: datetime
    topics: list[InsightTopic]
