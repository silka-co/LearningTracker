"""Q&A session and message models."""

from sqlalchemy import Column, Integer, Text, ForeignKey, DateTime, func

from app.database import Base


class QASession(Base):
    __tablename__ = "qa_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    episode_id = Column(Integer, ForeignKey("episodes.id"), nullable=True)
    title = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class QAMessage(Base):
    __tablename__ = "qa_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(
        Integer, ForeignKey("qa_sessions.id", ondelete="CASCADE"), nullable=False
    )
    role = Column(Text, nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    follow_up_questions = Column(Text, nullable=True)  # JSON list of strings
    created_at = Column(DateTime, server_default=func.now())
