-- Backfill: set each episode's topic_id from its podcast's topic_id (idempotent)
UPDATE episodes
SET topic_id = (
    SELECT podcasts.topic_id
    FROM podcasts
    WHERE podcasts.id = episodes.podcast_id
)
WHERE episodes.topic_id IS NULL;

-- Index for fast topic filtering (idempotent)
CREATE INDEX IF NOT EXISTS idx_episodes_topic ON episodes(topic_id);
