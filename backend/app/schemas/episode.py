from datetime import datetime

from pydantic import BaseModel


class EpisodeResponse(BaseModel):
    id: int
    podcast_id: int | None = None
    guid: str
    title: str
    description: str | None
    audio_url: str
    published_at: datetime | None
    duration_seconds: int | None
    audio_status: str
    transcription_status: str
    analysis_status: str
    audio_file_path: str | None
    error_message: str | None
    created_at: datetime
    podcast_title: str | None = None
    topic_ids: list[int] = []
    topic_names: list[str] = []

    model_config = {"from_attributes": True}


class EpisodeListItem(BaseModel):
    id: int
    podcast_id: int | None = None
    topic_id: int | None = None  # kept for backwards compat
    topic_ids: list[int] = []
    title: str
    podcast_title: str | None = None
    topic_name: str | None = None  # kept for backwards compat
    topic_names: list[str] = []
    published_at: datetime | None
    duration_seconds: int | None
    audio_status: str
    transcription_status: str
    analysis_status: str
    created_at: datetime | None = None
    trashed_at: datetime | None = None

    model_config = {"from_attributes": True}


class EpisodeTopicUpdate(BaseModel):
    topic_id: int | None


class EpisodeTopicToggle(BaseModel):
    topic_id: int


class TaskStatusResponse(BaseModel):
    task_id: str
    task_type: str
    episode_id: int | None
    status: str
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
