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
     :5173                          :8000                  |
                                      |                    |
                                  ThreadPoolExecutor       |
                                  (download, transcribe,   |
                                   analyze — in-process) --+
```

- **Backend**: Python FastAPI with SQLAlchemy ORM
- **Frontend**: React + TypeScript + Tailwind CSS (Vite)
- **Database**: SQLite with FTS5 full-text search
- **Tasks**: ThreadPoolExecutor (in-process, no separate worker needed)
- **Transcription**: AssemblyAI (default) or faster-whisper (local fallback)
- **AI**: Anthropic Claude API

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/topics` | Create a topic |
| GET | `/api/topics` | List all topics |
| PUT | `/api/topics/{id}` | Update a topic |
| DELETE | `/api/topics/{id}` | Delete a topic |
| POST | `/api/podcasts` | Add podcast feed (auto-queues latest 5 episodes) |
| GET | `/api/podcasts` | List podcasts (filter by `?topic_id=`) |
| POST | `/api/podcasts/{id}/refresh` | Refresh feed, auto-queue new episodes |
| POST | `/api/podcasts/refresh-stale` | Refresh all stale podcast feeds |
| POST | `/api/podcasts/refresh-all` | Refresh all podcast feeds |
| POST | `/api/podcasts/{id}/unfollow` | Unfollow a podcast (keep episodes) |
| DELETE | `/api/podcasts/{id}` | Delete a podcast |
| GET | `/api/episodes` | List episodes (filter by podcast, topic, status) |
| GET | `/api/episodes/{id}` | Episode detail |
| POST | `/api/episodes/{id}/process` | Manually trigger processing |
| POST | `/api/episodes/{id}/trash` | Trash an episode |
| POST | `/api/episodes/{id}/restore` | Restore a trashed episode |
| GET | `/api/episodes/{id}/transcript` | Get episode transcript |
| GET | `/api/episodes/{id}/analysis` | Get AI analysis |
| POST | `/api/episodes/{id}/chat` | Chat with episode content |
| POST | `/api/episodes/{id}/topics` | Assign topics to an episode |
| GET | `/api/tasks/episode/{id}/status` | Check processing status |
| GET | `/api/tasks/processing` | List all currently processing episodes |
| GET | `/api/insights` | Get cross-episode insights |
| GET | `/api/health` | Health check |

## Processing Pipeline

```
Add RSS Feed → Parse Episodes → Auto-download Latest 5
                                       ↓
                              Download Audio (ThreadPool)
                                       ↓
                            Transcribe (AssemblyAI / Whisper)
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
    main.py           # FastAPI app + ThreadPoolExecutor
    config.py          # Settings from .env
    database.py        # SQLite setup
    models/            # SQLAlchemy ORM
    schemas/           # Pydantic validation
    routers/           # API endpoints
    services/          # Business logic (feed parser, downloader, transcription, AI)
    tasks/             # Background task management
    migrations/        # SQL schema
  tests/
frontend/
  src/
    pages/             # NewEpisodes, AllEpisodes, EpisodeDetail, PodcastDetail
    components/        # Layout, StatusBadge, TopicPicker, etc.
    api/               # API client
    store/             # Zustand state
    types/             # TypeScript types
data/                  # Runtime: SQLite DBs, audio files (gitignored)
```

## Requirements

- Python 3.11+
- Node.js 18+
- AssemblyAI API key (for transcription)
- Anthropic API key (for AI analysis)
- FFmpeg (only if using local whisper transcription)
