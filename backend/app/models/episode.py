from datetime import datetime

from sqlalchemy import (
    String, Text, Integer, Float, DateTime, ForeignKey, UniqueConstraint, Table, Column, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# Many-to-many junction table
episode_topics = Table(
    "episode_topics",
    Base.metadata,
    Column("episode_id", Integer, ForeignKey("episodes.id", ondelete="CASCADE"), primary_key=True),
    Column("topic_id", Integer, ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True),
)


class Episode(Base):
    __tablename__ = "episodes"
    __table_args__ = (
        UniqueConstraint("podcast_id", "guid", name="uq_episode_podcast_guid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    podcast_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("podcasts.id", ondelete="SET NULL"), nullable=True
    )
    topic_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("topics.id"), nullable=True
    )
    guid: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    audio_url: Mapped[str] = mapped_column(String, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)

    # Processing pipeline status
    audio_status: Mapped[str] = mapped_column(String, default="pending")
    transcription_status: Mapped[str] = mapped_column(String, default="pending")
    analysis_status: Mapped[str] = mapped_column(String, default="pending")

    audio_file_path: Mapped[str | None] = mapped_column(String)
    error_message: Mapped[str | None] = mapped_column(Text)
    trashed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    podcast: Mapped["Podcast"] = relationship(back_populates="episodes")  # noqa: F821
    topics: Mapped[list["Topic"]] = relationship(secondary=episode_topics, lazy="selectin")  # noqa: F821


class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    episode_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("episodes.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    full_text: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str | None] = mapped_column(String)
    word_count: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"
    __table_args__ = (
        UniqueConstraint("episode_id", "segment_index", name="uq_segment_episode_index"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    episode_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("episodes.id", ondelete="CASCADE"), nullable=False
    )
    segment_index: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)


class EpisodeSummary(Base):
    __tablename__ = "episode_summaries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    episode_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("episodes.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    one_line: Mapped[str] = mapped_column(Text, nullable=False)
    short_summary: Mapped[str] = mapped_column(Text, nullable=False)
    detailed_summary: Mapped[str] = mapped_column(Text, nullable=False)
    key_points: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array
    notable_quotes: Mapped[str | None] = mapped_column(Text)  # JSON array
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
