-- Add per-episode topic assignment
-- Episodes inherit their podcast's topic by default but can be reassigned individually.

-- Add topic_id column to episodes (nullable FK to topics)
-- NOTE: This will fail with "duplicate column" on re-run, which init_db handles gracefully.
ALTER TABLE episodes ADD COLUMN topic_id INTEGER REFERENCES topics(id);
