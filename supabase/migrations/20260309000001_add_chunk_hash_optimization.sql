-- ============================================================================
-- PHASE 42.1 — Chunk Hash Optimization
-- Date: 2026-03-09
-- ============================================================================
-- Context:
--   Adds chunk_hash column for deduplication optimization.
--   Prevents recomputing embeddings for identical chunk content.
--
-- Effects:
--   1. Adds chunk_hash TEXT column for SHA256 hashes
--   2. Creates index on chunk_hash for fast lookup
--   3. Allows skipping embedding generation for duplicate content

-- ── 1. Add chunk_hash column for deduplication ───────────────────────────
ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS chunk_hash VARCHAR(64);

-- Index for fast duplicate lookups by hash
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_hash
  ON knowledge_chunks(chunk_hash);

-- ============================================================================
-- Rollback:
--   DROP INDEX IF EXISTS idx_knowledge_chunks_hash;
--   ALTER TABLE knowledge_chunks DROP COLUMN IF EXISTS chunk_hash;
-- ============================================================================
