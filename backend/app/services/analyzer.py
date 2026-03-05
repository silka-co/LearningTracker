"""AI analysis service using Claude API for podcast episode summaries."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class AnalysisError(Exception):
    """Raised when AI analysis fails."""


@dataclass
class AnalysisResult:
    """Complete analysis result from Claude."""

    one_line: str
    short_summary: str
    detailed_summary: str
    key_points: list[str] = field(default_factory=list)
    notable_quotes: list[dict] = field(default_factory=list)


class AnalysisService:
    """Analyzes podcast transcripts using Claude API.

    Generates structured summaries including one-line, short, and detailed
    summaries, key points, and notable quotes.
    """

    MODEL = "claude-sonnet-4-20250514"

    def __init__(self, api_key: str):
        if not api_key:
            raise AnalysisError(
                "ANTHROPIC_API_KEY is not set. "
                "Get a key at https://console.anthropic.com/"
            )
        self.api_key = api_key

    def analyze(self, transcript_text: str, episode_title: str) -> AnalysisResult:
        """Analyze a podcast transcript and return structured summaries.

        Args:
            transcript_text: Full transcript text.
            episode_title: Episode title for context.

        Returns:
            AnalysisResult with summaries, key points, and notable quotes.

        Raises:
            AnalysisError: If analysis fails.
        """
        if not transcript_text or not transcript_text.strip():
            raise AnalysisError("Transcript text is empty")

        try:
            import anthropic
        except ImportError:
            raise AnalysisError(
                "anthropic is not installed. Install it with: pip install anthropic"
            )

        client = anthropic.Anthropic(api_key=self.api_key)

        prompt = f"""Analyze this podcast episode transcript and return a JSON object with the following fields:

1. "one_line": A single compelling sentence summarizing the episode (max 150 chars)
2. "short_summary": A 2-3 sentence summary of the main discussion
3. "detailed_summary": A thorough 2-4 paragraph summary covering all major topics discussed
4. "key_points": An array of 5-8 key takeaways as concise bullet-point strings
5. "notable_quotes": An array of 3-5 notable direct quotes from the transcript, each as an object with "quote" (the exact quote) and "speaker" (speaker name if identifiable, otherwise "Speaker")

Episode title: {episode_title}

Transcript:
{transcript_text}

Return ONLY valid JSON, no markdown formatting or code fences."""

        try:
            logger.info("Sending transcript to Claude for analysis: %s", episode_title)

            message = client.messages.create(
                model=self.MODEL,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )

            response_text = message.content[0].text.strip()

            # Handle potential markdown code fences in response
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                # Remove first and last lines (```json and ```)
                lines = [l for l in lines if not l.strip().startswith("```")]
                response_text = "\n".join(lines)

            data = json.loads(response_text)

            result = AnalysisResult(
                one_line=data.get("one_line", ""),
                short_summary=data.get("short_summary", ""),
                detailed_summary=data.get("detailed_summary", ""),
                key_points=data.get("key_points", []),
                notable_quotes=data.get("notable_quotes", []),
            )

            logger.info(
                "Analysis complete: %d key points, %d quotes",
                len(result.key_points),
                len(result.notable_quotes),
            )

            return result

        except json.JSONDecodeError as e:
            raise AnalysisError(f"Failed to parse Claude response as JSON: {e}")
        except anthropic.APIError as e:
            raise AnalysisError(f"Claude API error: {e}")
        except AnalysisError:
            raise
        except Exception as e:
            raise AnalysisError(f"Analysis failed: {e}")
