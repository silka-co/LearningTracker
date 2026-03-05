"""Transcription services: AssemblyAI (cloud) and faster-whisper (local)."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.config import Settings

logger = logging.getLogger(__name__)

# Module-level model cache (loaded lazily on first use)
_model = None


class TranscriptionError(Exception):
    """Raised when transcription fails."""


@dataclass
class TranscriptSegment:
    """A single segment of transcribed audio with timestamps."""

    segment_index: int
    start_time: float
    end_time: float
    text: str


@dataclass
class TranscriptionResult:
    """Complete transcription result."""

    full_text: str
    language: str
    segments: list[TranscriptSegment] = field(default_factory=list)

    @property
    def word_count(self) -> int:
        return len(self.full_text.split())


class TranscriptionService:
    """Transcribes audio files using faster-whisper (CTranslate2 backend).

    Usage:
        service = TranscriptionService(model_size="medium", device="cpu", compute_type="int8")
        result = service.transcribe("/path/to/audio.mp3")
        print(result.full_text)
        for seg in result.segments:
            print(f"[{seg.start_time:.1f}s] {seg.text}")
    """

    def __init__(
        self,
        model_size: str = "medium",
        device: str = "cpu",
        compute_type: str = "int8",
    ):
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type

    def _get_model(self):
        """Lazy-load the Whisper model (cached globally across calls)."""
        global _model

        if _model is not None:
            return _model

        try:
            from faster_whisper import WhisperModel

            logger.info(
                "Loading Whisper model: %s (device=%s, compute_type=%s)",
                self.model_size,
                self.device,
                self.compute_type,
            )
            _model = WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=self.compute_type,
            )
            logger.info("Whisper model loaded successfully")
            return _model
        except ImportError:
            raise TranscriptionError(
                "faster-whisper is not installed. "
                "Install it with: pip install faster-whisper"
            )
        except Exception as e:
            raise TranscriptionError(f"Failed to load Whisper model: {e}")

    def transcribe(self, audio_file_path: str | Path) -> TranscriptionResult:
        """Transcribe an audio file and return the full text with segments.

        Args:
            audio_file_path: Path to the audio file (mp3, wav, etc.)

        Returns:
            TranscriptionResult with full_text, language, and timestamped segments.

        Raises:
            TranscriptionError: If the file doesn't exist or transcription fails.
        """
        audio_path = Path(audio_file_path)

        if not audio_path.exists():
            raise TranscriptionError(f"Audio file not found: {audio_path}")

        model = self._get_model()

        try:
            logger.info("Starting transcription: %s", audio_path.name)
            segments_iter, info = model.transcribe(
                str(audio_path),
                beam_size=5,
                vad_filter=True,  # Filter out silence for faster processing
            )

            language = info.language
            logger.info(
                "Detected language: %s (probability: %.2f)",
                language,
                info.language_probability,
            )

            # Collect segments
            segments = []
            text_parts = []
            for i, segment in enumerate(segments_iter):
                text = segment.text.strip()
                if text:
                    segments.append(
                        TranscriptSegment(
                            segment_index=i,
                            start_time=segment.start,
                            end_time=segment.end,
                            text=text,
                        )
                    )
                    text_parts.append(text)

            full_text = " ".join(text_parts)
            logger.info(
                "Transcription complete: %d segments, %d words",
                len(segments),
                len(full_text.split()),
            )

            return TranscriptionResult(
                full_text=full_text,
                language=language,
                segments=segments,
            )

        except TranscriptionError:
            raise
        except Exception as e:
            raise TranscriptionError(f"Transcription failed: {e}")


class AssemblyAITranscriptionService:
    """Transcribes audio files using AssemblyAI's cloud API.

    Uploads the audio file, polls for completion, and returns
    sentence-level segments with timestamps. Typically completes
    in 30s-2min for a 1-hour episode.
    """

    def __init__(self, api_key: str):
        if not api_key:
            raise TranscriptionError(
                "ASSEMBLYAI_API_KEY is not set. "
                "Get a key at https://www.assemblyai.com/dashboard/signup"
            )
        self.api_key = api_key

    def transcribe(self, audio_file_path: str | Path) -> TranscriptionResult:
        audio_path = Path(audio_file_path)

        if not audio_path.exists():
            raise TranscriptionError(f"Audio file not found: {audio_path}")

        try:
            import assemblyai as aai
        except ImportError:
            raise TranscriptionError(
                "assemblyai is not installed. Install it with: pip install assemblyai"
            )

        aai.settings.api_key = self.api_key

        try:
            logger.info("Uploading to AssemblyAI: %s", audio_path.name)
            config = aai.TranscriptionConfig(language_detection=True)
            transcriber = aai.Transcriber(config=config)
            transcript = transcriber.transcribe(str(audio_path))

            if transcript.status == aai.TranscriptStatus.error:
                raise TranscriptionError(f"AssemblyAI error: {transcript.error}")

            language = transcript.json_response.get("language_code", "en")
            full_text = transcript.text or ""

            # Get sentence-level segments (similar granularity to Whisper)
            sentences = transcript.get_sentences() or []
            segments = []
            for i, sentence in enumerate(sentences):
                text = sentence.text.strip()
                if text:
                    segments.append(
                        TranscriptSegment(
                            segment_index=i,
                            start_time=sentence.start / 1000.0,
                            end_time=sentence.end / 1000.0,
                            text=text,
                        )
                    )

            logger.info(
                "AssemblyAI transcription complete: %d segments, %d words",
                len(segments),
                len(full_text.split()),
            )

            return TranscriptionResult(
                full_text=full_text,
                language=language,
                segments=segments,
            )

        except TranscriptionError:
            raise
        except Exception as e:
            raise TranscriptionError(f"AssemblyAI transcription failed: {e}")


def get_transcription_service(settings: Settings):
    """Factory that returns the configured transcription backend."""
    if settings.TRANSCRIPTION_BACKEND == "assemblyai":
        return AssemblyAITranscriptionService(api_key=settings.ASSEMBLYAI_API_KEY)
    return TranscriptionService(
        model_size=settings.WHISPER_MODEL,
        device=settings.WHISPER_DEVICE,
        compute_type=settings.WHISPER_COMPUTE_TYPE,
    )
