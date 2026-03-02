-- Podcast Learning Companion - Initial Schema
-- SQLite with FTS5 full-text search

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- Topics for organizing podcasts
CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Podcast feeds
CREATE TABLE IF NOT EXISTS podcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER NOT NULL REFERENCES topics(id),
    title TEXT NOT NULL,
    feed_url TEXT NOT NULL UNIQUE,
    description TEXT,
    author TEXT,
    image_url TEXT,
    last_fetched_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual episodes
CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    podcast_id INTEGER NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
    guid TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    audio_url TEXT NOT NULL,
    published_at TIMESTAMP,
    duration_seconds INTEGER,
    -- Processing pipeline status
    audio_status TEXT DEFAULT 'pending'
        CHECK(audio_status IN ('pending', 'downloading', 'downloaded', 'failed', 'skipped')),
    transcription_status TEXT DEFAULT 'pending'
        CHECK(transcription_status IN ('pending', 'processing', 'completed', 'failed')),
    analysis_status TEXT DEFAULT 'pending'
        CHECK(analysis_status IN ('pending', 'processing', 'completed', 'failed')),
    audio_file_path TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(podcast_id, guid)
);

-- Full transcript text (one per episode)
CREATE TABLE IF NOT EXISTS transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL UNIQUE REFERENCES episodes(id) ON DELETE CASCADE,
    full_text TEXT NOT NULL,
    language TEXT,
    word_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Timestamped transcript segments
CREATE TABLE IF NOT EXISTS transcript_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    segment_index INTEGER NOT NULL,
    start_time REAL NOT NULL,
    end_time REAL NOT NULL,
    text TEXT NOT NULL,
    UNIQUE(episode_id, segment_index)
);

-- AI-generated episode summaries
CREATE TABLE IF NOT EXISTS episode_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL UNIQUE REFERENCES episodes(id) ON DELETE CASCADE,
    one_line TEXT NOT NULL,
    short_summary TEXT NOT NULL,
    detailed_summary TEXT NOT NULL,
    key_points TEXT NOT NULL,       -- JSON array of strings
    notable_quotes TEXT,            -- JSON array of {quote, timestamp}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Concepts extracted from episodes
CREATE TABLE IF NOT EXISTS concepts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    topic_id INTEGER REFERENCES topics(id),
    first_seen_episode_id INTEGER REFERENCES episodes(id),
    mention_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-many: episodes <-> concepts
CREATE TABLE IF NOT EXISTS episode_concepts (
    episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    concept_id INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    relevance TEXT CHECK(relevance IN ('primary', 'secondary', 'mentioned')),
    context_snippet TEXT,
    PRIMARY KEY (episode_id, concept_id)
);

-- Cross-episode concept connections
CREATE TABLE IF NOT EXISTS concept_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    concept_id_a INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    concept_id_b INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Flexible tags
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS episode_tags (
    episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (episode_id, tag_id)
);

-- Q&A sessions
CREATE TABLE IF NOT EXISTS qa_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER REFERENCES topics(id),
    episode_id INTEGER REFERENCES episodes(id),
    title TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qa_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES qa_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quiz system
CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER REFERENCES topics(id),
    episode_id INTEGER REFERENCES episodes(id),
    title TEXT NOT NULL,
    question_count INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_index INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK(question_type IN (
        'multiple_choice', 'true_false', 'short_answer', 'fill_blank'
    )),
    options TEXT,                    -- JSON array for multiple choice
    correct_answer TEXT NOT NULL,
    explanation TEXT NOT NULL,
    source_episode_id INTEGER REFERENCES episodes(id),
    source_timestamp REAL,
    UNIQUE(quiz_id, question_index)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    score REAL
);

CREATE TABLE IF NOT EXISTS quiz_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES quiz_questions(id),
    user_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    feedback TEXT
);

-- Background task tracking
CREATE TABLE IF NOT EXISTS task_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    task_type TEXT NOT NULL,
    episode_id INTEGER REFERENCES episodes(id),
    status TEXT DEFAULT 'queued'
        CHECK(status IN ('queued', 'running', 'completed', 'failed', 'retrying')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- FTS5 full-text search indexes
CREATE VIRTUAL TABLE IF NOT EXISTS transcripts_fts USING fts5(
    full_text,
    content='transcripts',
    content_rowid='id',
    tokenize='porter unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS summaries_fts USING fts5(
    one_line,
    short_summary,
    detailed_summary,
    content='episode_summaries',
    content_rowid='id',
    tokenize='porter unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS concepts_fts USING fts5(
    name,
    description,
    content='concepts',
    content_rowid='id',
    tokenize='porter unicode61'
);

-- Triggers to keep FTS indexes in sync

-- Transcripts FTS triggers
CREATE TRIGGER IF NOT EXISTS transcripts_fts_insert AFTER INSERT ON transcripts BEGIN
    INSERT INTO transcripts_fts(rowid, full_text) VALUES (new.id, new.full_text);
END;

CREATE TRIGGER IF NOT EXISTS transcripts_fts_delete AFTER DELETE ON transcripts BEGIN
    INSERT INTO transcripts_fts(transcripts_fts, rowid, full_text) VALUES ('delete', old.id, old.full_text);
END;

CREATE TRIGGER IF NOT EXISTS transcripts_fts_update AFTER UPDATE ON transcripts BEGIN
    INSERT INTO transcripts_fts(transcripts_fts, rowid, full_text) VALUES ('delete', old.id, old.full_text);
    INSERT INTO transcripts_fts(rowid, full_text) VALUES (new.id, new.full_text);
END;

-- Summaries FTS triggers
CREATE TRIGGER IF NOT EXISTS summaries_fts_insert AFTER INSERT ON episode_summaries BEGIN
    INSERT INTO summaries_fts(rowid, one_line, short_summary, detailed_summary)
    VALUES (new.id, new.one_line, new.short_summary, new.detailed_summary);
END;

CREATE TRIGGER IF NOT EXISTS summaries_fts_delete AFTER DELETE ON episode_summaries BEGIN
    INSERT INTO summaries_fts(summaries_fts, rowid, one_line, short_summary, detailed_summary)
    VALUES ('delete', old.id, old.one_line, old.short_summary, old.detailed_summary);
END;

CREATE TRIGGER IF NOT EXISTS summaries_fts_update AFTER UPDATE ON episode_summaries BEGIN
    INSERT INTO summaries_fts(summaries_fts, rowid, one_line, short_summary, detailed_summary)
    VALUES ('delete', old.id, old.one_line, old.short_summary, old.detailed_summary);
    INSERT INTO summaries_fts(rowid, one_line, short_summary, detailed_summary)
    VALUES (new.id, new.one_line, new.short_summary, new.detailed_summary);
END;

-- Concepts FTS triggers
CREATE TRIGGER IF NOT EXISTS concepts_fts_insert AFTER INSERT ON concepts BEGIN
    INSERT INTO concepts_fts(rowid, name, description) VALUES (new.id, new.name, new.description);
END;

CREATE TRIGGER IF NOT EXISTS concepts_fts_delete AFTER DELETE ON concepts BEGIN
    INSERT INTO concepts_fts(concepts_fts, rowid, name, description) VALUES ('delete', old.id, old.name, old.description);
END;

CREATE TRIGGER IF NOT EXISTS concepts_fts_update AFTER UPDATE ON concepts BEGIN
    INSERT INTO concepts_fts(concepts_fts, rowid, name, description) VALUES ('delete', old.id, old.name, old.description);
    INSERT INTO concepts_fts(rowid, name, description) VALUES (new.id, new.name, new.description);
END;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_episodes_podcast ON episodes(podcast_id);
CREATE INDEX IF NOT EXISTS idx_episodes_audio_status ON episodes(audio_status);
CREATE INDEX IF NOT EXISTS idx_episodes_transcription_status ON episodes(transcription_status);
CREATE INDEX IF NOT EXISTS idx_episodes_analysis_status ON episodes(analysis_status);
CREATE INDEX IF NOT EXISTS idx_episodes_published_at ON episodes(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_podcasts_topic ON podcasts(topic_id);
CREATE INDEX IF NOT EXISTS idx_concepts_topic ON concepts(topic_id);
CREATE INDEX IF NOT EXISTS idx_qa_sessions_topic ON qa_sessions(topic_id);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_episode ON transcript_segments(episode_id);
CREATE INDEX IF NOT EXISTS idx_task_log_episode ON task_log(episode_id);
CREATE INDEX IF NOT EXISTS idx_task_log_status ON task_log(status);
