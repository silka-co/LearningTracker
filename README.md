# Podcast Learning Companion

AI-powered podcast learning system with summaries, Q&A, quizzes, and a growing knowledge base.

Subscribe to podcast RSS feeds, automatically download and transcribe episodes, then use Claude AI to deeply understand content organized by topics (politics, vibe coding, design, etc.).

## Quick Start

```bash
# 1. Clone and setup
cp .env.example .env
# Edit .env to add your ANTHROPIC_API_KEY and ASSEMBLYAI_API_KEY

# 2. Install dependencies
make setup

# 3. Start the app (run each in a separate terminal)
make backend    # API server on http://localhost:8000
make frontend   # React app on http://localhost:5173
```

## Architecture

```
Frontend (React + Tailwind)  -->  Backend (FastAPI)  -->  SQLite
     :5173                          :8000
                                (background tasks run in-process
                                 via ThreadPoolExecutor)
```

- **Backend**: Python FastAPI with SQLAlchemy ORM
- **Frontend**: React + TypeScript + Tailwind CSS (Vite)
- **Database**: SQLite with FTS5 full-text search
- **Tasks**: ThreadPoolExecutor running inside the FastAPI process (no separate worker needed)
- **Transcription**: AssemblyAI (default) or faster-whisper (local fallback)
- **AI**: Anthropic Claude API for analysis and Q&A

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/topics` | Create a topic |
| GET | `/api/topics` | List all topics |
| PUT | `/api/topics/{id}` | Update a topic |
| DELETE | `/api/topics/{id}` | Delete a topic |
| POST | `/api/podcasts` | Add podcast feed (auto-queues latest 5 episodes) |
| GET | `/api/podcasts` | List podcasts |
| POST | `/api/podcasts/{id}/refresh` | Refresh feed, auto-queue new episodes |
| DELETE | `/api/podcasts/{id}` | Delete a podcast |
| GET | `/api/episodes` | List episodes (filter by podcast, topic, status) |
| GET | `/api/episodes/{id}` | Episode detail |
| POST | `/api/episodes/{id}/process` | Manually trigger processing |
| GET | `/api/episodes/{id}/transcript` | Get episode transcript |
| GET | `/api/episodes/{id}/analysis` | Get AI analysis and summary |
| POST | `/api/episodes/{id}/chat` | Chat with episode content |
| GET | `/api/episodes/insights` | Get insights timeline |
| GET | `/api/tasks/episode/{id}/status` | Check processing status |
| GET | `/api/health` | Health check |

## Processing Pipeline

```
Add RSS Feed → Parse Episodes → Auto-download Latest 5
                                       ↓
                              Download Audio
                                       ↓
                            Transcribe (AssemblyAI)
                                       ↓
                           AI Analysis (Claude)
```

## Development

```bash
# Run tests
make test

# Clean runtime data
make clean
```

## Project Structure

```
backend/
  app/
    main.py           # FastAPI app with lifespan (starts ThreadPoolExecutor)
    config.py          # Settings from .env
    database.py        # SQLite setup
    models/            # SQLAlchemy ORM
    schemas/           # Pydantic validation
    routers/           # API endpoints
    services/          # Business logic (feed parser, downloader, transcriber, analyzer)
    tasks/             # Background task executor and task definitions
    migrations/        # SQL schema
  tests/
frontend/
  src/
    pages/             # Dashboard, NewEpisodes, AllEpisodes, PodcastDetail, EpisodeDetail, etc.
    components/        # Layout, StatusBadge, TopicPicker, ChatBar, AudioPlayer, etc.
    api/               # API client
    types/             # TypeScript types
data/                  # Runtime: SQLite DB, audio files (gitignored)
```

## Requirements

- Python 3.11+
- Node.js 18+
- AssemblyAI API key (for transcription)
- Anthropic API key (for AI analysis and Q&A)
- FFmpeg (only needed if using local faster-whisper transcription)
