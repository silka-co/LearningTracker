"""Test fixtures for the Podcast Learning Companion."""

import sqlite3
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app


@pytest.fixture
def tmp_dir(tmp_path):
    """Provide a temporary directory for test data."""
    return tmp_path


@pytest.fixture
def db_session(tmp_path):
    """Create a test database session with schema initialized."""
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    # Run migration SQL
    migrations_dir = Path(__file__).parent.parent / "app" / "migrations"
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    for sql_file in sorted(migrations_dir.glob("*.sql")):
        conn.executescript(sql_file.read_text())
    conn.close()

    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def client(db_session):
    """Create a FastAPI test client with the test database."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# Sample RSS feed XML for testing
SAMPLE_RSS_FEED = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Test Podcast</title>
    <description>A test podcast for unit testing</description>
    <itunes:author>Test Author</itunes:author>
    <itunes:image href="https://example.com/image.jpg"/>
    <link>https://example.com</link>
    <item>
      <title>Episode 3: Latest</title>
      <description>The latest episode</description>
      <guid>ep-003</guid>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <itunes:duration>01:30:00</itunes:duration>
      <enclosure url="https://example.com/ep3.mp3" length="54000000" type="audio/mpeg"/>
    </item>
    <item>
      <title>Episode 2: Middle</title>
      <description>&lt;p&gt;HTML &lt;b&gt;description&lt;/b&gt;&lt;/p&gt;</description>
      <guid>ep-002</guid>
      <pubDate>Fri, 15 Dec 2023 10:00:00 GMT</pubDate>
      <itunes:duration>45:30</itunes:duration>
      <enclosure url="https://example.com/ep2.mp3" length="27000000" type="audio/mpeg"/>
    </item>
    <item>
      <title>Episode 1: First</title>
      <description>The first episode</description>
      <guid>ep-001</guid>
      <pubDate>Fri, 01 Dec 2023 08:00:00 GMT</pubDate>
      <itunes:duration>3600</itunes:duration>
      <enclosure url="https://example.com/ep1.mp3" length="54000000" type="audio/mpeg"/>
    </item>
    <item>
      <title>Bonus: No Audio</title>
      <description>This item has no audio enclosure</description>
      <guid>bonus-001</guid>
      <pubDate>Wed, 01 Nov 2023 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>"""
