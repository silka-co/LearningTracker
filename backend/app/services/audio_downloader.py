"""Audio file downloader for podcast episodes.

Downloads audio files from URLs with streaming support, progress tracking,
and proper file organization.
"""

import logging
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

# Map MIME types and URL extensions to canonical file extensions
EXTENSION_MAP = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/mp4": ".m4a",
    "audio/m4a": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/aac": ".aac",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/flac": ".flac",
}

DEFAULT_TIMEOUT = httpx.Timeout(30.0, read=300.0)  # 5min read timeout for large files


class DownloadError(Exception):
    """Raised when a download fails."""

    pass


class AudioDownloader:
    """Downloads podcast audio files to local storage.

    Files are organized as: {audio_dir}/{podcast_id}/{episode_id}.{ext}
    """

    def __init__(self, audio_dir: str | Path):
        self.audio_dir = Path(audio_dir)

    def download(
        self,
        url: str,
        podcast_id: int,
        episode_id: int,
        progress_callback: Optional[Callable[[int, int], None]] = None,
    ) -> Path:
        """Download an audio file from a URL.

        Args:
            url: The audio file URL.
            podcast_id: Used for directory organization.
            episode_id: Used for the filename.
            progress_callback: Optional callback(bytes_downloaded, total_bytes).

        Returns:
            Path to the downloaded file.

        Raises:
            DownloadError: If the download fails.
        """
        # Create podcast subdirectory
        podcast_dir = self.audio_dir / str(podcast_id)
        podcast_dir.mkdir(parents=True, exist_ok=True)

        try:
            with httpx.Client(timeout=DEFAULT_TIMEOUT, follow_redirects=True) as client:
                with client.stream("GET", url) as response:
                    response.raise_for_status()

                    # Determine file extension
                    ext = self._detect_extension(url, response)

                    # Target file path
                    file_path = podcast_dir / f"{episode_id}{ext}"
                    temp_path = podcast_dir / f"{episode_id}{ext}.tmp"

                    # Get total size for progress tracking
                    total_bytes = int(response.headers.get("content-length", 0))
                    downloaded = 0

                    logger.info(
                        "Downloading episode %d: %s (%s bytes)",
                        episode_id,
                        url[:100],
                        total_bytes or "unknown",
                    )

                    # Stream to temp file, then rename on success
                    with open(temp_path, "wb") as f:
                        for chunk in response.iter_bytes(chunk_size=65536):
                            f.write(chunk)
                            downloaded += len(chunk)
                            if progress_callback and total_bytes:
                                progress_callback(downloaded, total_bytes)

                    # Rename temp to final path
                    temp_path.rename(file_path)

                    logger.info(
                        "Downloaded episode %d: %s (%d bytes)",
                        episode_id,
                        file_path.name,
                        downloaded,
                    )
                    return file_path

        except httpx.HTTPStatusError as e:
            raise DownloadError(
                f"HTTP {e.response.status_code} downloading {url}"
            ) from e
        except httpx.RequestError as e:
            raise DownloadError(f"Network error downloading {url}: {e}") from e
        except OSError as e:
            raise DownloadError(f"File system error: {e}") from e
        finally:
            # Clean up temp file on failure
            temp_candidate = podcast_dir / f"{episode_id}*.tmp"
            for tmp in podcast_dir.glob(f"{episode_id}*.tmp"):
                tmp.unlink(missing_ok=True)

    def get_audio_path(self, podcast_id: int, episode_id: int) -> Optional[Path]:
        """Look up an existing downloaded audio file.

        Returns the path if found, None otherwise.
        """
        podcast_dir = self.audio_dir / str(podcast_id)
        if not podcast_dir.exists():
            return None
        for path in podcast_dir.iterdir():
            if path.stem == str(episode_id) and path.suffix in EXTENSION_MAP.values():
                return path
        return None

    def delete_audio(self, podcast_id: int, episode_id: int) -> bool:
        """Delete a downloaded audio file. Returns True if deleted."""
        path = self.get_audio_path(podcast_id, episode_id)
        if path and path.exists():
            path.unlink()
            return True
        return False

    def _detect_extension(self, url: str, response: httpx.Response) -> str:
        """Determine the file extension from content-type or URL."""
        # Try Content-Type header
        content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
        if content_type in EXTENSION_MAP:
            return EXTENSION_MAP[content_type]

        # Try URL path extension
        path = urlparse(url).path.lower()
        for ext in EXTENSION_MAP.values():
            if path.endswith(ext):
                return ext

        # Default to mp3
        return ".mp3"
