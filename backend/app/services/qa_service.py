"""Q&A chat service using Claude API for contextual episode questions."""

from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

FOLLOW_UP_INSTRUCTION = """

After your answer, suggest 3 brief follow-up questions the user might want to ask. Format them on separate lines at the very end of your response, wrapped in a FOLLOWUP block like this:

<<<FOLLOWUP>>>
What specific strategies were mentioned for this?
How does this compare to other approaches discussed?
Were there any counterarguments raised?
<<<END_FOLLOWUP>>>

Keep the follow-up questions short (under 60 characters), specific to the conversation context, and genuinely useful."""


class QAService:
    """Answers user questions about podcast episodes using Claude."""

    MODEL = "claude-sonnet-4-20250514"

    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY is required for Q&A")
        self.api_key = api_key

    @staticmethod
    def _parse_follow_ups(text: str) -> tuple[str, list[str]]:
        """Extract follow-up questions from response text.

        Returns (answer_text, follow_up_questions).
        """
        pattern = r"<<<FOLLOWUP>>>\s*(.*?)\s*<<<END_FOLLOWUP>>>"
        match = re.search(pattern, text, re.DOTALL)

        if not match:
            return text.strip(), []

        # Extract the answer (everything before the FOLLOWUP block)
        answer = text[:match.start()].strip()

        # Parse questions (one per line, strip numbering/bullets)
        raw = match.group(1).strip()
        questions = []
        for line in raw.split("\n"):
            line = line.strip()
            # Strip leading numbers, bullets, dashes
            line = re.sub(r"^[\d]+[.)]\s*", "", line)
            line = re.sub(r"^[-*]\s*", "", line)
            line = line.strip()
            if line:
                questions.append(line)

        return answer, questions[:3]

    def ask(
        self,
        question: str,
        history: list[dict],
        transcript_text: str | None = None,
        summary: str | None = None,
        episode_title: str | None = None,
        episode_contexts: list[dict] | None = None,
    ) -> dict:
        """Send a question with context and conversation history to Claude.

        For episode-level Q&A, provide transcript_text + summary + episode_title.
        For topic/dashboard-level Q&A, provide episode_contexts (list of dicts
        with title, summary, transcript).

        Args:
            question: The user's question.
            history: Previous messages as [{"role": "user"|"assistant", "content": "..."}].
            transcript_text: Full transcript (episode-level).
            summary: Short summary text (episode-level).
            episode_title: Episode title (episode-level).
            episode_contexts: List of episode contexts with transcripts (topic/dashboard-level).

        Returns:
            Dict with 'answer' (str) and 'follow_up_questions' (list[str]).
        """
        import anthropic

        client = anthropic.Anthropic(api_key=self.api_key)

        if transcript_text:
            # Episode-level context
            system_prompt = f"""You are a helpful podcast learning assistant. The user is asking questions about a specific podcast episode.

Episode: {episode_title}

Summary: {summary or "Not available"}

Full Transcript:
{transcript_text}

Answer the user's questions based on the episode content. Be conversational, specific, and reference what was actually said in the episode. If the answer isn't in the transcript, say so honestly. Keep responses concise but thorough.{FOLLOW_UP_INSTRUCTION}"""
        elif episode_contexts:
            # Topic/dashboard-level context with full transcripts
            episodes_text = ""
            for ctx in episode_contexts:
                episodes_text += f"\n\n{'='*60}\nEpisode: {ctx['title']}\n{'='*60}\n"
                if ctx.get('summary'):
                    episodes_text += f"\nSummary: {ctx['summary']}\n"
                if ctx.get('transcript'):
                    episodes_text += f"\nFull Transcript:\n{ctx['transcript']}\n"

            system_prompt = f"""You are a helpful podcast learning assistant. The user is asking questions across multiple podcast episodes. Here are the full transcripts and summaries:

{episodes_text}

Answer the user's questions based on what was actually said in these episodes. Be conversational, specific, and reference the episodes by name. You can draw connections across episodes. Keep responses concise but thorough.{FOLLOW_UP_INSTRUCTION}"""
        else:
            system_prompt = f"""You are a helpful podcast learning assistant. Answer the user's questions about podcasts and learning. If you need more context about specific episodes, suggest the user ask on a specific episode's detail page.{FOLLOW_UP_INSTRUCTION}"""

        messages = []
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": question})

        logger.info("Q&A request: %s (history: %d msgs)", question[:80], len(history))

        response = client.messages.create(
            model=self.MODEL,
            max_tokens=2048,
            system=system_prompt,
            messages=messages,
        )

        raw_answer = response.content[0].text
        answer, follow_ups = self._parse_follow_ups(raw_answer)
        logger.info("Q&A response: %d chars, %d follow-ups", len(answer), len(follow_ups))

        return {"answer": answer, "follow_up_questions": follow_ups}
