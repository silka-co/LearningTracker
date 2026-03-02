from datetime import datetime

from pydantic import BaseModel


class EpisodeResponse(BaseModel):
    id: int
    podcast_id: int
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

    model_config = {"from_attributes": True}


class EpisodeListItem(BaseModel):
    id: int
    podcast_id: int
    title: str
    published_at: datetime | None
    duration_seconds: int | None
    audio_status: str
    transcription_status: str
    analysis_status: str

    model_config = {"from_attributes": True}


class TaskStatusResponse(BaseModel):
    task_id: str
    task_type: str
    episode_id: int | None
    status: str
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
