-- ============================================================================
-- PHASE 41 — DROP LEGACY embedding COLUMN
-- Date: 2026-03-06
-- ============================================================================
-- Context:
--   Migration 068_knowledge_chunks.sql introduced embedding VECTOR(1536) as
--   the per-chunk vector store (Phase 36.8).
--
--   Migration 20260304000001_phase30_pgvector_embeddings.sql (Phase 30)
--   superseded it with embedding_vector VECTOR(384) backed by an HNSW index
--   and the match_knowledge_chunks() RPC.
--
--   All code now writes exclusively to embedding_vector.
--   No application code reads from embedding.
--   Keeping the column wastes ~1536×4 = 6 KB per row and creates schema
--   confusion; this migration removes it cleanly.
--
-- Effects:
--   • Drops embedding VECTOR(1536) from knowledge_chunks.
--   • CASCADE drops the two partial indexes created in migration 072 that
--     reference this column:
--       - idx_chunks_missing_embeddings   (WHERE embedding IS NULL)
--       - idx_chunks_ready_composite      (document_id, embedding)
--   • Does NOT touch embedding_vector VECTOR(384) or its HNSW index.
--   • Does NOT touch match_knowledge_chunks() (reads embedding_vector only).
--
-- Rollback:
--   ALTER TABLE knowledge_chunks ADD COLUMN embedding VECTOR(1536);
--   (re-creating the indexes is optional; they were maintenance-only)
-- ============================================================================

-- ── 1. Drop orphan indexes explicitly before the column drop ────────────────
-- PostgreSQL will CASCADE-drop them automatically with the column, but being
-- explicit avoids any "still referenced by index" errors on some PG versions.

DROP INDEX IF EXISTS idx_chunks_missing_embeddings;
DROP INDEX IF EXISTS idx_chunks_ready_composite;
-- Legacy HNSW on the old column (was commented-out in 072 but guard anyway)
DROP INDEX IF EXISTS idx_knowledge_chunks_embedding_hnsw;

-- ── 2. Drop the legacy column ────────────────────────────────────────────────

ALTER TABLE knowledge_chunks
  DROP COLUMN IF EXISTS embedding;

-- ── 3. Confirm active vector infrastructure is intact ───────────────────────
-- These are no-ops if already present; they make the migration self-healing
-- when applied against a partially-migrated database.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS embedding_vector vector(384);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_vector_hnsw
  ON knowledge_chunks
  USING hnsw (embedding_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(384),
  match_count     int DEFAULT 10
)
RETURNS TABLE (
  id          uuid,
  document_id uuid,
  content     text,
  chunk_index int,
  similarity  float
)
LANGUAGE sql STABLE AS $$
  SELECT
    id,
    document_id,
    content,
    chunk_index,
    1 - (embedding_vector <=> query_embedding) AS similarity
  FROM knowledge_chunks
  WHERE embedding_vector IS NOT NULL
  ORDER BY embedding_vector <=> query_embedding
  LIMIT match_count;
$$;

-- ── 4. Verification queries (run manually after applying) ───────────────────
-- Confirm embedding column is gone:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'knowledge_chunks'
--   ORDER BY ordinal_position;
--
-- Confirm only embedding_vector VECTOR(384) remains as a vector column:
--   SELECT column_name, udt_name
--   FROM information_schema.columns
--   WHERE table_name = 'knowledge_chunks'
--     AND udt_name = 'vector';
--   Expected: one row → embedding_vector
--
-- Confirm HNSW index exists:
--   SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE tablename = 'knowledge_chunks'
--     AND indexname = 'idx_knowledge_chunks_embedding_vector_hnsw';
--
-- Confirm no data loss (chunk content still intact):
--   SELECT COUNT(*), COUNT(embedding_vector) FROM knowledge_chunks;
