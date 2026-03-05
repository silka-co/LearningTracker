-- Many-to-many relationship between episodes and topics
CREATE TABLE IF NOT EXISTS episode_topics (
    episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    topic_id   INTEGER NOT NULL REFERENCES topics(id)   ON DELETE CASCADE,
    PRIMARY KEY (episode_id, topic_id)
);

-- Migrate existing single topic_id data into the junction table
INSERT OR IGNORE INTO episode_topics (episode_id, topic_id)
SELECT id, topic_id FROM episodes WHERE topic_id IS NOT NULL;
