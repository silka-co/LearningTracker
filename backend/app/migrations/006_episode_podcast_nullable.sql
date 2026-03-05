-- Make podcast_id nullable on episodes so unfollowed podcast episodes are kept
-- SQLite doesn't support ALTER COLUMN, so we recreate the table

PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS episodes_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    podcast_id INTEGER REFERENCES podcasts(id) ON DELETE SET NULL,
    topic_id INTEGER REFERENCES topics(id),
    guid VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    description TEXT,
    audio_url VARCHAR NOT NULL,
    published_at DATETIME,
    duration_seconds INTEGER,
    audio_status VARCHAR DEFAULT 'pending',
    transcription_status VARCHAR DEFAULT 'pending',
    analysis_status VARCHAR DEFAULT 'pending',
    audio_file_path VARCHAR,
    error_message TEXT,
    trashed_at DATETIME,
    created_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(podcast_id, guid)
);

INSERT OR IGNORE INTO episodes_new
SELECT id, podcast_id, topic_id, guid, title, description, audio_url,
       published_at, duration_seconds, audio_status, transcription_status,
       analysis_status, audio_file_path, error_message, trashed_at, created_at
FROM episodes;

DROP TABLE episodes;

ALTER TABLE episodes_new RENAME TO episodes;

PRAGMA foreign_keys=ON;
