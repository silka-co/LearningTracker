"""Tests for the RSS feed parser service."""

from unittest.mock import patch

import feedparser
import pytest

from app.services.feed_parser import FeedParserService, FeedParseError
from tests.conftest import SAMPLE_RSS_FEED


# Pre-parse the sample feed once (outside any mock context)
_PARSED_SAMPLE = feedparser.parse(SAMPLE_RSS_FEED)


@pytest.fixture
def parser():
    return FeedParserService()


class TestFeedParserService:
    def test_parse_valid_feed(self, parser):
        """Test parsing a valid podcast RSS feed."""
        with patch("feedparser.parse", return_value=_PARSED_SAMPLE):
            result = parser.parse_feed("https://example.com/feed.xml")

        assert result.title == "Test Podcast"
        assert result.description == "A test podcast for unit testing"
        assert result.author == "Test Author"
        assert result.image_url == "https://example.com/image.jpg"

    def test_extracts_episodes_with_audio(self, parser):
        """Test that only entries with audio enclosures become episodes."""
        with patch("feedparser.parse", return_value=_PARSED_SAMPLE):
            result = parser.parse_feed("https://example.com/feed.xml")

        # 3 episodes with audio, 1 without (should be filtered)
        assert len(result.episodes) == 3
        guids = [ep.guid for ep in result.episodes]
        assert "ep-003" in guids
        assert "ep-002" in guids
        assert "ep-001" in guids
        assert "bonus-001" not in guids

    def test_episodes_sorted_by_date_newest_first(self, parser):
        """Test that episodes are sorted by published date, newest first."""
        with patch("feedparser.parse", return_value=_PARSED_SAMPLE):
            result = parser.parse_feed("https://example.com/feed.xml")

        assert result.episodes[0].guid == "ep-003"
        assert result.episodes[1].guid == "ep-002"
        assert result.episodes[2].guid == "ep-001"

    def test_parse_duration_hhmmss(self, parser):
        """Test parsing HH:MM:SS duration format."""
        assert parser._parse_duration({"itunes_duration": "01:30:00"}) == 5400

    def test_parse_duration_mmss(self, parser):
        """Test parsing MM:SS duration format."""
        assert parser._parse_duration({"itunes_duration": "45:30"}) == 2730

    def test_parse_duration_seconds(self, parser):
        """Test parsing raw seconds duration format."""
        assert parser._parse_duration({"itunes_duration": "3600"}) == 3600

    def test_parse_duration_none(self, parser):
        """Test that missing duration returns None."""
        assert parser._parse_duration({}) is None

    def test_clean_html(self, parser):
        """Test HTML tag stripping from descriptions."""
        result = parser._clean_html("<p>Hello <b>world</b></p>")
        assert result == "Hello world"

    def test_clean_html_none(self, parser):
        """Test that None input returns None."""
        assert parser._clean_html(None) is None

    def test_audio_url_extraction_from_enclosure(self, parser):
        """Test extracting audio URL from standard enclosure."""
        entry = {
            "enclosures": [
                {"href": "https://example.com/ep.mp3", "type": "audio/mpeg"}
            ]
        }
        result = parser._extract_audio_url(entry)
        assert result == ("https://example.com/ep.mp3", "audio/mpeg")

    def test_audio_url_extraction_by_extension(self, parser):
        """Test extracting audio URL by file extension when MIME is missing."""
        entry = {
            "enclosures": [
                {"href": "https://example.com/ep.mp3", "type": ""}
            ]
        }
        result = parser._extract_audio_url(entry)
        assert result is not None
        assert result[0] == "https://example.com/ep.mp3"

    def test_no_audio_returns_none(self, parser):
        """Test that entries without audio return None."""
        entry = {"enclosures": [], "links": []}
        assert parser._extract_audio_url(entry) is None

    def test_has_audio_extension(self, parser):
        """Test audio extension detection in URLs."""
        assert parser._has_audio_extension("https://example.com/ep.mp3") is True
        assert parser._has_audio_extension("https://example.com/ep.m4a") is True
        assert parser._has_audio_extension("https://example.com/page.html") is False

    def test_invalid_feed_raises_error(self, parser):
        """Test that an invalid feed raises FeedParseError."""
        with patch("feedparser.parse") as mock_parse:
            mock_result = type("FeedResult", (), {
                "bozo": True,
                "bozo_exception": Exception("Invalid XML"),
                "entries": [],
                "feed": {},
            })()
            mock_parse.return_value = mock_result

            with pytest.raises(FeedParseError):
                parser.parse_feed("https://example.com/bad-feed")
