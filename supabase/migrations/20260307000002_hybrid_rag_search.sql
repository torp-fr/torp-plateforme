-- ============================================================================
-- PHASE 42 — Hybrid RAG Search (pgvector + full-text)
-- Date: 2026-03-07
-- ============================================================================
-- Context:
--   Upgrades the RAG retrieval pipeline from pure vector similarity search to
--   a hybrid model combining:
--     • pgvector cosine similarity  (weight 0.7)
--     • PostgreSQL full-text search (weight 0.3)
--
--   Dimension change: embedding_vector vector(384) → vector(1536)
--   Reason: generate-embedding edge function now returns 1536-dim vectors
--   (text-embedding-3-small with dimensions=1536).
--
-- Effects:
--   1. Adds tsv tsvector GENERATED column for French FTS on chunk content.
--   2. Drops old embedding_vector vector(384) column and HNSW index.
--   3. Creates embedding_vector vector(1536) with a new HNSW index.
--   4. Drops old match_knowledge_chunks(vector(384), int) signature.
--   5. Creates match_knowledge_chunks(vector(1536), text, int) with hybrid scoring.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS match_knowledge_chunks(vector, text, int);
--   ALTER TABLE knowledge_chunks DROP COLUMN IF EXISTS embedding_vector;
--   ALTER TABLE knowledge_chunks ADD COLUMN embedding_vector vector(384);
--   CREATE INDEX idx_knowledge_chunks_embedding_vector_hnsw ON knowledge_chunks
--     USING hnsw (embedding_vector vector_cosine_ops) WITH (m = 16, ef_construction = 200);
--   ALTER TABLE knowledge_chunks DROP COLUMN IF EXISTS tsv;
--   CREATE OR REPLACE FUNCTION match_knowledge_chunks(
--     query_embedding vector(384), match_count int DEFAULT 10)
--   RETURNS TABLE (id uuid, document_id uuid, content text, chunk_index int, similarity float)
--   LANGUAGE sql STABLE AS $$
--     SELECT id, document_id, content, chunk_index,
--            1 - (embedding_vector <=> query_embedding) AS similarity
--     FROM knowledge_chunks WHERE embedding_vector IS NOT NULL
--     ORDER BY embedding_vector <=> query_embedding LIMIT match_count;
--   $$;
-- ============================================================================

-- ── 1. Add tsv column for French full-text search ──────────────────────────
-- GENERATED ALWAYS AS keeps the tsvector in sync with content automatically.
-- Using 'french' dictionary for accent-insensitive, stemmed search.

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('french', content)) STORED;

-- GIN index for fast FTS lookups on the stored tsvector
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tsv
  ON knowledge_chunks
  USING GIN (tsv);

-- ── 2. Upgrade embedding_vector from vector(384) to vector(1536) ────────────
-- PostgreSQL does not support ALTER COLUMN for vector dimension changes.
-- The old 384-dim vectors are incompatible with the new 1536-dim model;
-- all chunks will need re-embedding after this migration.

-- Drop HNSW index on the old 384-dim column
DROP INDEX IF EXISTS idx_knowledge_chunks_embedding_vector_hnsw;

-- Drop old column (irreversible — 384-dim data is no longer compatible)
ALTER TABLE knowledge_chunks
  DROP COLUMN IF EXISTS embedding_vector;

-- Recreate column with 1536 dimensions (text-embedding-3-small)
ALTER TABLE knowledge_chunks
  ADD COLUMN embedding_vector vector(1536);

-- HNSW index for cosine similarity on 1536-dim vectors
-- m=16 / ef_construction=200: standard production config for RAG
CREATE INDEX idx_knowledge_chunks_embedding_vector_hnsw
  ON knowledge_chunks
  USING hnsw (embedding_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

-- ── 3. Drop old function signature before replacing ─────────────────────────
-- The old function accepted vector(384) with 2 params; new signature has 3
-- params and vector(1536). CREATE OR REPLACE requires matching signatures,
-- so we must DROP first.

DROP FUNCTION IF EXISTS match_knowledge_chunks(vector, int);

-- ── 4. Create hybrid match_knowledge_chunks function ───────────────────────
-- Scoring formula:
--   vector_score = 1 - (embedding_vector <=> query_embedding)   [0..1]
--   text_score   = ts_rank(tsv, plainto_tsquery('french', query_text))  [0..∞]
--   final_score  = vector_score * 0.7 + text_score * 0.3
--
-- Notes:
--   • ts_rank is not bounded to [0,1] but is typically well below 1 for
--     normal documents, so the weighting remains sensible in practice.
--   • Rows with NULL embedding_vector are excluded from vector scoring;
--     only chunks that have been re-embedded after this migration are returned.
--   • query_text fallback: if empty string is passed, plainto_tsquery returns
--     a null tsquery and ts_rank returns 0, so vector score dominates.

CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
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

-- ── 5. Grant execute to authenticated users ─────────────────────────────────
GRANT EXECUTE ON FUNCTION match_knowledge_chunks(vector, text, int)
  TO authenticated, anon, service_role;

-- ── 6. Verification queries (run manually after applying) ───────────────────
-- Confirm tsv column exists as a generated column:
--   SELECT column_name, generation_expression
--   FROM information_schema.columns
--   WHERE table_name = 'knowledge_chunks' AND column_name = 'tsv';
--
-- Confirm embedding_vector is now vector(1536):
--   SELECT column_name, udt_name
--   FROM information_schema.columns
--   WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding_vector';
--
-- Confirm function signature:
--   SELECT proname, pg_get_function_arguments(oid)
--   FROM pg_proc WHERE proname = 'match_knowledge_chunks';
--   Expected: match_knowledge_chunks(query_embedding vector, query_text text, match_count integer)
