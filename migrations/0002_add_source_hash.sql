ALTER TABLE songs ADD COLUMN source_hash TEXT;
CREATE UNIQUE INDEX idx_songs_source_hash ON songs(source_hash) WHERE source_hash IS NOT NULL AND deleted_at IS NULL;
