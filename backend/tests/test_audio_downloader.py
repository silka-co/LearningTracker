"""Tests for the audio downloader service."""

import pytest
import httpx

from app.services.audio_downloader import AudioDownloader, DownloadError


@pytest.fixture
def downloader(tmp_path):
    return AudioDownloader(tmp_path / "audio")


class TestAudioDownloader:
    def test_download_creates_file(self, downloader, httpx_mock):
        """Test that download creates the audio file in the right location."""
        httpx_mock.add_response(
            url="https://example.com/ep.mp3",
            content=b"fake audio data",
            headers={"content-type": "audio/mpeg", "content-length": "15"},
        )

        path = downloader.download("https://example.com/ep.mp3", podcast_id=1, episode_id=42)

        assert path.exists()
        assert path.name == "42.mp3"
        assert path.parent.name == "1"
        assert path.read_bytes() == b"fake audio data"

    def test_download_detects_extension_from_content_type(self, downloader, httpx_mock):
        """Test file extension detection from Content-Type header."""
        httpx_mock.add_response(
            url="https://example.com/audio",
            content=b"data",
            headers={"content-type": "audio/mp4"},
        )

        path = downloader.download("https://example.com/audio", podcast_id=1, episode_id=1)
        assert path.suffix == ".m4a"

    def test_download_detects_extension_from_url(self, downloader, httpx_mock):
        """Test file extension detection from URL when Content-Type is generic."""
        httpx_mock.add_response(
            url="https://example.com/podcast/episode.m4a",
            content=b"data",
            headers={"content-type": "application/octet-stream"},
        )

        path = downloader.download(
            "https://example.com/podcast/episode.m4a",
            podcast_id=1,
            episode_id=1,
        )
        assert path.suffix == ".m4a"

    def test_download_defaults_to_mp3(self, downloader, httpx_mock):
        """Test that unknown content types default to .mp3."""
        httpx_mock.add_response(
            url="https://example.com/audio",
            content=b"data",
            headers={"content-type": "application/octet-stream"},
        )

        path = downloader.download("https://example.com/audio", podcast_id=1, episode_id=1)
        assert path.suffix == ".mp3"

    def test_download_creates_podcast_directory(self, downloader, httpx_mock):
        """Test that the podcast subdirectory is created."""
        httpx_mock.add_response(
            url="https://example.com/ep.mp3",
            content=b"data",
            headers={"content-type": "audio/mpeg"},
        )

        path = downloader.download("https://example.com/ep.mp3", podcast_id=99, episode_id=1)
        assert path.parent.name == "99"
        assert path.parent.exists()

    def test_download_http_error(self, downloader, httpx_mock):
        """Test that HTTP errors raise DownloadError."""
        httpx_mock.add_response(url="https://example.com/ep.mp3", status_code=404)

        with pytest.raises(DownloadError, match="HTTP 404"):
            downloader.download("https://example.com/ep.mp3", podcast_id=1, episode_id=1)

    def test_download_progress_callback(self, downloader, httpx_mock):
        """Test that progress callback is called during download."""
        data = b"x" * 1000
        httpx_mock.add_response(
            url="https://example.com/ep.mp3",
            content=data,
            headers={"content-type": "audio/mpeg", "content-length": str(len(data))},
        )

        progress_calls = []
        downloader.download(
            "https://example.com/ep.mp3",
            podcast_id=1,
            episode_id=1,
            progress_callback=lambda downloaded, total: progress_calls.append((downloaded, total)),
        )

        assert len(progress_calls) > 0
        # Last call should show all bytes downloaded
        assert progress_calls[-1][0] == len(data)
        assert progress_calls[-1][1] == len(data)

    def test_get_audio_path_found(self, downloader, httpx_mock):
        """Test finding an existing audio file."""
        httpx_mock.add_response(
            url="https://example.com/ep.mp3",
            content=b"data",
            headers={"content-type": "audio/mpeg"},
        )
        downloader.download("https://example.com/ep.mp3", podcast_id=1, episode_id=42)

        path = downloader.get_audio_path(podcast_id=1, episode_id=42)
        assert path is not None
        assert path.name == "42.mp3"

    def test_get_audio_path_not_found(self, downloader):
        """Test that missing audio returns None."""
        assert downloader.get_audio_path(podcast_id=999, episode_id=999) is None

    def test_delete_audio(self, downloader, httpx_mock):
        """Test deleting a downloaded audio file."""
        httpx_mock.add_response(
            url="https://example.com/ep.mp3",
            content=b"data",
            headers={"content-type": "audio/mpeg"},
        )
        downloader.download("https://example.com/ep.mp3", podcast_id=1, episode_id=42)

        assert downloader.delete_audio(podcast_id=1, episode_id=42) is True
        assert downloader.get_audio_path(podcast_id=1, episode_id=42) is None

    def test_delete_nonexistent_audio(self, downloader):
        """Test deleting a file that doesn't exist."""
        assert downloader.delete_audio(podcast_id=999, episode_id=999) is False
