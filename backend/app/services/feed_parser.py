"""RSS feed parser for podcast feeds.

Parses standard podcast RSS feeds (RSS 2.0, Atom) and extracts podcast
metadata along with episode information including audio enclosure URLs.
"""

import re
import logging
from dataclasses import dataclass, field
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Optional
from urllib.parse import urlparse

import feedparser

logger = logging.getLogger(__name__)

# Audio MIME types we accept from enclosures
AUDIO_MIME_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/aac",
    "audio/ogg",
    "audio/wav",
    "audio/x-wav",
    "audio/flac",
}

# File extensions that indicate audio files
AUDIO_EXTENSIONS = {".mp3", ".m4a", ".mp4", ".aac", ".ogg", ".wav", ".flac", ".opus"}


@dataclass
class ParsedEpisode:
    guid: str
    title: str
    description: Optional[str]
    audio_url: str
    audio_type: str
    published_at: Optional[datetime]
    duration_seconds: Optional[int]


@dataclass
class ParsedFeed:
    title: str
    description: Optional[str]
    author: Optional[str]
    image_url: Optional[str]
    episodes: list[ParsedEpisode] = field(default_factory=list)


class FeedParseError(Exception):
    """Raised when a feed cannot be parsed."""

    pass


class FeedParserService:
    """Parses podcast RSS/Atom feeds and extracts episode metadata."""

    def parse_feed(self, feed_url: str) -> ParsedFeed:
        """Fetch and parse a podcast RSS feed URL.

        Returns a ParsedFeed with podcast metadata and a list of episodes
        that have audio enclosures. Episodes are sorted by published date
        (most recent first).

        Raises FeedParseError if the feed cannot be fetched or parsed.
        """
        try:
            feed = feedparser.parse(feed_url)
        except Exception as e:
            raise FeedParseError(f"Failed to fetch feed: {e}") from e

        if feed.bozo and not feed.entries:
            raise FeedParseError(
                f"Feed parse error: {feed.bozo_exception}"
            )

        if not feed.feed.get("title"):
            raise FeedParseError("Feed has no title — may not be a valid podcast feed")

        # Extract podcast-level metadata
        podcast = ParsedFeed(
            title=feed.feed.get("title", "Untitled Podcast"),
            description=self._clean_html(feed.feed.get("summary") or feed.feed.get("subtitle")),
            author=self._extract_author(feed.feed),
            image_url=self._extract_image(feed.feed),
        )

        # Extract episodes with audio enclosures
        for entry in feed.entries:
            episode = self._parse_entry(entry)
            if episode is not None:
                podcast.episodes.append(episode)

        # Sort by published date (most recent first), episodes without dates go to the end
        podcast.episodes.sort(
            key=lambda e: e.published_at or datetime.min,
            reverse=True,
        )

        logger.info(
            "Parsed feed '%s': %d episodes with audio",
            podcast.title,
            len(podcast.episodes),
        )
        return podcast

    def _parse_entry(self, entry) -> Optional[ParsedEpisode]:
        """Parse a single feed entry into a ParsedEpisode, or None if no audio."""
        audio = self._extract_audio_url(entry)
        if audio is None:
            return None

        audio_url, audio_type = audio

        # Get GUID (fall back to audio URL if no guid)
        guid = entry.get("id") or entry.get("guid") or audio_url

        # Parse published date
        published_at = self._parse_date(entry)

        # Parse duration from iTunes tags or other sources
        duration_seconds = self._parse_duration(entry)

        return ParsedEpisode(
            guid=guid,
            title=entry.get("title", "Untitled Episode"),
            description=self._clean_html(entry.get("summary") or entry.get("description")),
            audio_url=audio_url,
            audio_type=audio_type,
            published_at=published_at,
            duration_seconds=duration_seconds,
        )

    def _extract_audio_url(self, entry) -> Optional[tuple[str, str]]:
        """Extract audio URL and MIME type from feed entry.

        Checks enclosures first, then links. Returns (url, mime_type) or None.
        """
        # Check enclosures (standard RSS 2.0 podcasting method)
        for enclosure in entry.get("enclosures", []):
            mime_type = enclosure.get("type", "").lower()
            url = enclosure.get("href") or enclosure.get("url", "")
            if mime_type in AUDIO_MIME_TYPES:
                return (url, mime_type)
            # Some feeds don't set MIME type correctly, check URL extension
            if url and self._has_audio_extension(url):
                return (url, mime_type or "audio/mpeg")

        # Check links as fallback
        for link in entry.get("links", []):
            mime_type = link.get("type", "").lower()
            url = link.get("href", "")
            if mime_type in AUDIO_MIME_TYPES:
                return (url, mime_type)
            if link.get("rel") == "enclosure" and url and self._has_audio_extension(url):
                return (url, mime_type or "audio/mpeg")

        return None

    def _has_audio_extension(self, url: str) -> bool:
        """Check if a URL path ends with a known audio file extension."""
        path = urlparse(url).path.lower()
        return any(path.endswith(ext) for ext in AUDIO_EXTENSIONS)

    def _extract_author(self, feed_info) -> Optional[str]:
        """Extract author from feed metadata."""
        # iTunes author tag
        author = feed_info.get("author")
        if author:
            return author
        # itunes:owner
        if hasattr(feed_info, "publisher"):
            return feed_info.publisher
        return None

    def _extract_image(self, feed_info) -> Optional[str]:
        """Extract podcast artwork URL from feed metadata."""
        # iTunes image
        image = feed_info.get("image")
        if isinstance(image, dict) and image.get("href"):
            return image["href"]
        if isinstance(image, dict) and image.get("url"):
            return image["url"]
        # Direct href
        if hasattr(feed_info, "image") and hasattr(feed_info.image, "href"):
            return feed_info.image.href
        return None

    def _parse_date(self, entry) -> Optional[datetime]:
        """Parse published date from a feed entry."""
        # feedparser provides parsed time tuples
        if entry.get("published_parsed"):
            try:
                from time import mktime
                return datetime.fromtimestamp(mktime(entry.published_parsed))
            except (ValueError, OverflowError, OSError):
                pass

        # Fall back to raw string parsing
        date_str = entry.get("published") or entry.get("updated")
        if date_str:
            try:
                return parsedate_to_datetime(date_str)
            except (ValueError, TypeError):
                pass

        return None

    def _parse_duration(self, entry) -> Optional[int]:
        """Parse episode duration to seconds.

        Handles formats:
        - "HH:MM:SS"
        - "MM:SS"
        - "3600" (raw seconds)
        - iTunes duration tags
        """
        # Check itunes:duration
        duration_str = entry.get("itunes_duration")
        if not duration_str:
            return None

        duration_str = str(duration_str).strip()

        # Pure numeric = seconds
        if duration_str.isdigit():
            return int(duration_str)

        # HH:MM:SS or MM:SS
        parts = duration_str.split(":")
        try:
            if len(parts) == 3:
                h, m, s = parts
                return int(h) * 3600 + int(m) * 60 + int(float(s))
            elif len(parts) == 2:
                m, s = parts
                return int(m) * 60 + int(float(s))
        except (ValueError, TypeError):
            pass

        return None

    def _clean_html(self, text: Optional[str]) -> Optional[str]:
        """Strip HTML tags from text content."""
        if not text:
            return None
        # Simple HTML tag removal
        clean = re.sub(r"<[^>]+>", "", text)
        # Normalize whitespace
        clean = re.sub(r"\s+", " ", clean).strip()
        return clean if clean else None
