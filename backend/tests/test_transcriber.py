"""Tests for the transcription service."""

import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from app.services.transcriber import (
    TranscriptionService,
    TranscriptionError,
    TranscriptionResult,
    TranscriptSegment,
)


@pytest.fixture
def service():
    """Create a TranscriptionService instance."""
    return TranscriptionService(
        model_size="tiny",
        device="cpu",
        compute_type="int8",
    )


@pytest.fixture
def mock_segments():
    """Create mock Whisper segments."""
    seg1 = MagicMock()
    seg1.start = 0.0
    seg1.end = 5.2
    seg1.text = "  Hello and welcome to the podcast.  "

    seg2 = MagicMock()
    seg2.start = 5.2
    seg2.end = 12.8
    seg2.text = "  Today we'll discuss AI and design.  "

    seg3 = MagicMock()
    seg3.start = 12.8
    seg3.end = 18.0
    seg3.text = "  Let's get started.  "

    return [seg1, seg2, seg3]


@pytest.fixture
def mock_info():
    """Create mock transcription info."""
    info = MagicMock()
    info.language = "en"
    info.language_probability = 0.98
    return info


class TestTranscriptionResult:
    def test_word_count(self):
        result = TranscriptionResult(
            full_text="Hello and welcome to the podcast",
            language="en",
            segments=[],
        )
        assert result.word_count == 6

    def test_word_count_empty(self):
        result = TranscriptionResult(full_text="", language="en", segments=[])
        assert result.word_count == 0

    def test_segments_stored(self):
        seg = TranscriptSegment(
            segment_index=0, start_time=0.0, end_time=5.0, text="Hello"
        )
        result = TranscriptionResult(
            full_text="Hello", language="en", segments=[seg]
        )
        assert len(result.segments) == 1
        assert result.segments[0].start_time == 0.0


class TestTranscriptionService:
    def test_transcribe_file_not_found(self, service):
        with pytest.raises(TranscriptionError, match="Audio file not found"):
            service.transcribe("/nonexistent/path/audio.mp3")

    @patch("app.services.transcriber._model", None)
    def test_transcribe_missing_dependency(self, service, tmp_path):
        audio_file = tmp_path / "test.mp3"
        audio_file.write_bytes(b"fake audio data")

        with patch.dict("sys.modules", {"faster_whisper": None}):
            with patch(
                "app.services.transcriber.TranscriptionService._get_model",
                side_effect=TranscriptionError("faster-whisper is not installed"),
            ):
                with pytest.raises(TranscriptionError, match="not installed"):
                    service.transcribe(str(audio_file))

    @patch("app.services.transcriber._model")
    def test_transcribe_success(self, mock_model, service, tmp_path, mock_segments, mock_info):
        audio_file = tmp_path / "episode.mp3"
        audio_file.write_bytes(b"fake audio data")

        mock_model.transcribe.return_value = (iter(mock_segments), mock_info)

        result = service.transcribe(str(audio_file))

        assert isinstance(result, TranscriptionResult)
        assert result.language == "en"
        assert len(result.segments) == 3
        assert "Hello and welcome" in result.full_text
        assert "AI and design" in result.full_text
        assert "Let's get started" in result.full_text

    @patch("app.services.transcriber._model")
    def test_transcribe_segments_have_timestamps(self, mock_model, service, tmp_path, mock_segments, mock_info):
        audio_file = tmp_path / "episode.mp3"
        audio_file.write_bytes(b"fake audio data")

        mock_model.transcribe.return_value = (iter(mock_segments), mock_info)

        result = service.transcribe(str(audio_file))

        assert result.segments[0].start_time == 0.0
        assert result.segments[0].end_time == 5.2
        assert result.segments[1].start_time == 5.2
        assert result.segments[2].end_time == 18.0

    @patch("app.services.transcriber._model")
    def test_transcribe_segments_indexed(self, mock_model, service, tmp_path, mock_segments, mock_info):
        audio_file = tmp_path / "episode.mp3"
        audio_file.write_bytes(b"fake audio data")

        mock_model.transcribe.return_value = (iter(mock_segments), mock_info)

        result = service.transcribe(str(audio_file))

        for i, seg in enumerate(result.segments):
            assert seg.segment_index == i

    @patch("app.services.transcriber._model")
    def test_transcribe_strips_whitespace(self, mock_model, service, tmp_path, mock_segments, mock_info):
        audio_file = tmp_path / "episode.mp3"
        audio_file.write_bytes(b"fake audio data")

        mock_model.transcribe.return_value = (iter(mock_segments), mock_info)

        result = service.transcribe(str(audio_file))

        # Each segment text should be stripped
        for seg in result.segments:
            assert seg.text == seg.text.strip()
            assert not seg.text.startswith(" ")

    @patch("app.services.transcriber._model")
    def test_transcribe_skips_empty_segments(self, mock_model, service, tmp_path, mock_info):
        """Segments with only whitespace should be skipped."""
        empty_seg = MagicMock()
        empty_seg.start = 0.0
        empty_seg.end = 1.0
        empty_seg.text = "   "

        real_seg = MagicMock()
        real_seg.start = 1.0
        real_seg.end = 5.0
        real_seg.text = "Real content here."

        audio_file = tmp_path / "episode.mp3"
        audio_file.write_bytes(b"fake audio data")

        mock_model.transcribe.return_value = (iter([empty_seg, real_seg]), mock_info)

        result = service.transcribe(str(audio_file))

        assert len(result.segments) == 1
        assert result.segments[0].text == "Real content here."

    @patch("app.services.transcriber._model")
    def test_transcribe_model_error(self, mock_model, service, tmp_path):
        audio_file = tmp_path / "episode.mp3"
        audio_file.write_bytes(b"fake audio data")

        mock_model.transcribe.side_effect = RuntimeError("Model crashed")

        with pytest.raises(TranscriptionError, match="Transcription failed"):
            service.transcribe(str(audio_file))

    @patch("app.services.transcriber._model")
    def test_transcribe_word_count(self, mock_model, service, tmp_path, mock_segments, mock_info):
        audio_file = tmp_path / "episode.mp3"
        audio_file.write_bytes(b"fake audio data")

        mock_model.transcribe.return_value = (iter(mock_segments), mock_info)

        result = service.transcribe(str(audio_file))

        assert result.word_count > 0
        assert result.word_count == len(result.full_text.split())

    @patch("app.services.transcriber._model")
    def test_transcribe_accepts_path_object(self, mock_model, service, tmp_path, mock_segments, mock_info):
        audio_file = tmp_path / "episode.mp3"
        audio_file.write_bytes(b"fake audio data")

        mock_model.transcribe.return_value = (iter(mock_segments), mock_info)

        # Pass as Path object instead of string
        result = service.transcribe(audio_file)
        assert isinstance(result, TranscriptionResult)

    @patch("app.services.transcriber._model")
    def test_transcribe_calls_model_with_correct_params(self, mock_model, service, tmp_path, mock_segments, mock_info):
        audio_file = tmp_path / "episode.mp3"
        audio_file.write_bytes(b"fake audio data")

        mock_model.transcribe.return_value = (iter(mock_segments), mock_info)

        service.transcribe(str(audio_file))

        mock_model.transcribe.assert_called_once_with(
            str(audio_file),
            beam_size=5,
            vad_filter=True,
        )
