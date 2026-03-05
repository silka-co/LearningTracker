-- Make podcast topic_id nullable (topics are now episode-level only)
-- SQLite doesn't support ALTER COLUMN, so we recreate the table

PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS podcasts_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER,
    title VARCHAR NOT NULL,
    feed_url VARCHAR UNIQUE NOT NULL,
    description TEXT,
    author VARCHAR,
    image_url VARCHAR,
    last_fetched_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES topics(id)
);

INSERT OR IGNORE INTO podcasts_new SELECT * FROM podcasts;
DROP TABLE IF EXISTS podcasts;
ALTER TABLE podcasts_new RENAME TO podcasts;

-- Clear podcast topic_id since topics are now episode-only
UPDATE podcasts SET topic_id = NULL;

PRAGMA foreign_keys=ON;
