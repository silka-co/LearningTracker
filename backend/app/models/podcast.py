from datetime import datetime

from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Podcast(Base):
    __tablename__ = "podcasts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    topic_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("topics.id"), nullable=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    feed_url: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    author: Mapped[str | None] = mapped_column(String)
    image_url: Mapped[str | None] = mapped_column(String)
    last_fetched_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    episodes: Mapped[list["Episode"]] = relationship(  # noqa: F821
        back_populates="podcast",
    )
