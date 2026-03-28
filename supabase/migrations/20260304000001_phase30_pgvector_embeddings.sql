-- PHASE 30 — PGVECTOR EMBEDDING MIGRATION
-- Adds embedding_vector column for proper vector similarity search
-- Replaces in-memory JSON similarity with SQL-level pgvector operations
-- Model: text-embedding-3-small (dimensions=384)
-- Date: 2026-03-04

-- ============================================================================
-- EXTENSION
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- TABLE: knowledge_chunks — add embedding_vector column
-- ============================================================================
-- The existing `embedding` column (VECTOR(384)) remains for backward compat.
-- New writes target `embedding_vector`; semantic search reads from it.

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS embedding_vector vector(384);

-- ============================================================================
-- INDEX: HNSW for cosine similarity search
-- ============================================================================
-- HNSW provides O(log n) approximate nearest-neighbour search.
-- m=16 / ef_construction=200 is the standard production config for RAG.

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_vector_hnsw
  ON knowledge_chunks
  USING hnsw (embedding_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

-- ============================================================================
-- FUNCTION: match_knowledge_chunks
-- ============================================================================
-- Used by knowledgeIndex.semanticSearch() via supabase.rpc().
-- Returns chunks ordered by cosine similarity (highest first).
-- Similarity = 1 - cosine_distance  (range 0..1, 1 = identical).

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

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- DROP FUNCTION IF EXISTS match_knowledge_chunks(vector, int);
-- DROP INDEX  IF EXISTS idx_knowledge_chunks_embedding_vector_hnsw;
-- ALTER TABLE knowledge_chunks DROP COLUMN IF EXISTS embedding_vector;
