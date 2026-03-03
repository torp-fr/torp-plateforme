-- ============================================================================
-- MIGRATION: Add is_publishable governance to RAG search
-- PURPOSE: Apply KnowledgeIntegrityService publishability checks at DB level
-- PHASE: Post-KnowledgeIntegrityService implementation
-- ============================================================================
-- This migration adds the `is_publishable` governance filter to knowledge retrieval
-- Ensures only documents with integrity_score >= 0.7 and no critical issues are returned
--
-- Changes:
-- 1. Update knowledge_documents_ready view to include is_publishable column
-- 2. Modify search_knowledge_by_embedding RPC to:
--    - Add is_publishable to RETURNS TABLE
--    - Filter WHERE is_publishable = TRUE
-- 3. Modify search_knowledge_by_keyword RPC to:
--    - Add is_publishable to RETURNS TABLE
--    - Filter WHERE is_publishable = TRUE

-- ============================================================================
-- 1️⃣ UPDATE: knowledge_documents_ready view
-- ============================================================================
-- Add is_publishable to the ready view so it's accessible to RPC functions

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
WHERE d.ingestion_status = 'complete'
  AND d.embedding_integrity_checked = TRUE
  AND d.is_active = TRUE
  AND d.is_publishable = TRUE;

-- ============================================================================
-- 2️⃣ UPDATE: search_knowledge_by_embedding() RPC
-- ============================================================================
-- Add is_publishable to return type and filter results

CREATE OR REPLACE FUNCTION search_knowledge_by_embedding(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  chunk_index integer,
  token_count integer,
  embedding_similarity float,
  doc_title text,
  doc_category text,
  doc_source text,
  doc_created_at timestamp with time zone,
  is_publishable boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    c.chunk_index,
    c.token_count,
    (1.0 - (c.embedding <=> query_embedding))::float AS embedding_similarity,
    d.title,
    d.category,
    d.source,
    d.created_at,
    d.is_publishable
  FROM knowledge_chunks_ready c
  INNER JOIN knowledge_documents_ready d ON d.id = c.document_id
  WHERE c.embedding IS NOT NULL
    AND (1.0 - (c.embedding <=> query_embedding)) > match_threshold
    AND d.is_publishable = TRUE
  ORDER BY embedding_similarity DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 3️⃣ UPDATE: search_knowledge_by_keyword() RPC
-- ============================================================================
-- Add is_publishable to return type and filter results

CREATE OR REPLACE FUNCTION search_knowledge_by_keyword(
  search_query text,
  match_count int DEFAULT 5,
  p_category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  chunk_index integer,
  token_count integer,
  relevance_score float,
  doc_title text,
  doc_category text,
  doc_source text,
  is_publishable boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    c.chunk_index,
    c.token_count,
    ts_rank(
      to_tsvector('french', c.content),
      plainto_tsquery('french', search_query)
    )::float AS relevance_score,
    d.title,
    d.category,
    d.source,
    d.is_publishable
  FROM knowledge_chunks_ready c
  INNER JOIN knowledge_documents_ready d ON d.id = c.document_id
  WHERE to_tsvector('french', c.content) @@ plainto_tsquery('french', search_query)
    AND (p_category IS NULL OR d.category = p_category)
    AND d.is_publishable = TRUE
  ORDER BY relevance_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- SUMMARY OF CHANGES
-- ============================================================================
-- ✅ knowledge_documents_ready view now includes is_publishable
-- ✅ search_knowledge_by_embedding filters WHERE is_publishable = TRUE
-- ✅ search_knowledge_by_keyword filters WHERE is_publishable = TRUE
-- ✅ Both RPC functions return is_publishable in result set
-- ✅ Double enforcement: DB-level AND application-level
--
-- BACKWARD COMPATIBILITY:
-- ✅ VIEW: Existing clients can still query knowledge_documents_ready
--    (They will just get fewer rows due to is_publishable filter)
-- ✅ RPC: New column is_publishable added to result (won't break existing code)
--    (Existing code that ignores it will continue working)
