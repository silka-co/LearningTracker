-- Add trashed_at column for soft-delete
ALTER TABLE episodes ADD COLUMN trashed_at TIMESTAMP DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_episodes_trashed_at ON episodes(trashed_at);
