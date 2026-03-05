"""Pydantic schemas for transcript API responses."""

from datetime import datetime

from pydantic import BaseModel


class TranscriptSegmentResponse(BaseModel):
    segment_index: int
    start_time: float
    end_time: float
    text: str

    model_config = {"from_attributes": True}


class TranscriptResponse(BaseModel):
    id: int
    episode_id: int
    full_text: str
    language: str | None
    word_count: int | None
    created_at: datetime
    segments: list[TranscriptSegmentResponse]

    model_config = {"from_attributes": True}
