-- ============================================================================
-- FIX: RAG Retrieval Pipeline — Three targeted corrections
-- Date: 2026-03-16
-- ============================================================================
-- Context:
--   Migration 20260307000002_hybrid_rag_search.sql was written anticipating a
--   dimension upgrade to 1536, but has NOT been applied to the database.
--   The live schema still uses vector(384) as written in CLAUDE.md.
--
--   Three bugs are blocking all RAG retrieval:
--
--   BUG 1 — match_knowledge_chunks declared vector(1536) but all stored
--            embeddings and query embeddings are 384-dim. PostgreSQL raises
--            "different vector dimensions 384 and 1536" on every semantic
--            search call, which silently returns [].
--
--   BUG 2 — knowledge_documents_ready view filters ingestion_status = 'complete'
--            but the rag-worker writes ingestion_status = 'completed'.
--            No worker-ingested document is visible to keyword search.
--
--   BUG 3 — tsv GENERATED column referenced by the hybrid scoring formula
--            does not exist yet (it was part of the un-applied 20260307000002).
--            Without it the hybrid function cannot be created.
--
-- This migration does NOT touch:
--   • knowledge_chunks.embedding_vector column (stays vector(384))
--   • rag-worker or any ingestion code
--   • Any other table schema
-- ============================================================================


-- ── 1. Add tsv column for French full-text search ────────────────────────────
-- Required by the hybrid scoring formula in match_knowledge_chunks.
-- GENERATED ALWAYS AS keeps the tsvector in sync with content automatically.
-- ADD COLUMN IF NOT EXISTS makes this idempotent.

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('french', content)) STORED;

-- GIN index for fast FTS lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tsv
  ON knowledge_chunks
  USING GIN (tsv);


-- ── 2. Replace match_knowledge_chunks with correct vector(384) signature ─────
-- Must DROP all existing overloads first because CREATE OR REPLACE requires
-- an exact signature match.

DROP FUNCTION IF EXISTS match_knowledge_chunks(vector, text, int);
DROP FUNCTION IF EXISTS match_knowledge_chunks(vector, int);

CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(384),
  query_text      text,
  match_count     int DEFAULT 5
)
RETURNS TABLE (
  id          uuid,
  document_id uuid,
  content     text,
  similarity  float
)
LANGUAGE sql STABLE AS $$
  SELECT
    id,
    document_id,
    content,
    (
      (1 - (embedding_vector <=> query_embedding)) * 0.7
      + ts_rank(tsv, plainto_tsquery('french', query_text)) * 0.3
    ) AS similarity
  FROM knowledge_chunks
  WHERE embedding_vector IS NOT NULL
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_knowledge_chunks(vector, text, int)
  TO authenticated, anon, service_role;


-- ── 3. Fix knowledge_documents_ready view: accept 'completed' status ─────────
-- The rag-worker writes ingestion_status = 'completed' (with 'd').
-- The previous view filtered for 'complete' (without 'd'), making every
-- worker-processed document invisible to keyword search.
-- All other integrity conditions (embedding_integrity_checked, is_active,
-- is_publishable) are preserved unchanged.

CREATE OR REPLACE VIEW knowledge_documents_ready AS
SELECT
  d.id,
  d.title,
  d.category,
  d.source,
  d.version,
  d.file_size,
  d.chunk_count,
  d.created_by,
  d.created_at,
  d.updated_at,
  d.ingestion_status,
  d.ingestion_progress,
  d.ingestion_started_at,
  d.ingestion_completed_at,
  d.last_ingestion_error,
  d.last_ingestion_step,
  d.embedding_integrity_checked,
  d.is_active,
  d.reliability_score,
  d.is_publishable
FROM knowledge_documents d
WHERE d.ingestion_status = 'completed'
  AND d.embedding_integrity_checked = TRUE
  AND d.is_active = TRUE
  AND d.is_publishable = TRUE;


-- ── Verification queries (run manually after applying) ────────────────────────
-- Confirm tsv column:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'knowledge_chunks' AND column_name = 'tsv';
--
-- Confirm match_knowledge_chunks signature is vector(384):
--   SELECT pg_get_function_arguments(oid)
--   FROM pg_proc WHERE proname = 'match_knowledge_chunks';
--   Expected: query_embedding vector, query_text text, match_count integer
--
-- Confirm view status filter:
--   SELECT definition FROM pg_views WHERE viewname = 'knowledge_documents_ready';
--   Expected: ...ingestion_status = 'completed'...
