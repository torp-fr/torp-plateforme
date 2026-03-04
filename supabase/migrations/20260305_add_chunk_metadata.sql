-- PHASE 30 — Chunk metadata persistence
-- Adds a JSONB column to knowledge_chunks so that SmartChunker and
-- ChunkQualityFilter metadata (strategy, sectionHeader, qualityScore, …)
-- is stored alongside the chunk content.
-- Date: 2026-03-05

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- GIN index enables fast key/value lookups on the metadata document:
--   WHERE metadata @> '{"strategy": "regulation"}'
--   WHERE metadata ? 'qualityScore'
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_metadata
  ON knowledge_chunks
  USING GIN (metadata);
