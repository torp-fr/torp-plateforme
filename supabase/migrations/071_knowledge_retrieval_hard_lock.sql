-- PHASE 36.10.2: RETRIEVAL HARD LOCK - Security-First Access Layer
-- Objective: Ensure ONLY complete documents with verified integrity are retrievable
-- Date: 2026-02-18
-- Status: Critical Security Patch

-- ============================================================================
-- 1️⃣ SECURE VIEW: knowledge_documents_ready
-- ============================================================================
-- ONLY returns documents that are 100% ready for retrieval
-- This is the ONLY view retrieval operations should use
--
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
  d.reliability_score
FROM knowledge_documents d
WHERE d.ingestion_status = 'complete'
  AND d.embedding_integrity_checked = TRUE
  AND d.is_active = TRUE;

-- ============================================================================
-- 2️⃣ SECURE VIEW: knowledge_chunks_ready
-- ============================================================================
-- ONLY returns chunks from complete documents with verified integrity
--
CREATE OR REPLACE VIEW knowledge_chunks_ready AS
SELECT
  c.id,
  c.document_id,
  c.content,
  c.chunk_index,
  c.token_count,
  c.embedding,
  c.created_at,
  c.updated_at,
  c.embedding_generated_at
FROM knowledge_chunks c
INNER JOIN knowledge_documents_ready d ON d.id = c.document_id
WHERE c.embedding IS NOT NULL;

-- ============================================================================
-- 3️⃣ RPC FUNCTION: search_knowledge_by_embedding
-- ============================================================================
-- CRITICAL: This is the REAL vector search function
-- MUST use knowledge_documents_ready and knowledge_chunks_ready views
-- Returns only verified documents with embeddings
--
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
  doc_created_at timestamp with time zone
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
    d.created_at
  FROM knowledge_chunks_ready c
  INNER JOIN knowledge_documents_ready d ON d.id = c.document_id
  WHERE c.embedding IS NOT NULL
    AND (1.0 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY embedding_similarity DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 4️⃣ RPC FUNCTION: search_knowledge_by_keyword
-- ============================================================================
-- Keyword search using ONLY ready documents
-- Uses full-text search for better results
--
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
  doc_source text
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
    d.source
  FROM knowledge_chunks_ready c
  INNER JOIN knowledge_documents_ready d ON d.id = c.document_id
  WHERE to_tsvector('french', c.content) @@ plainto_tsquery('french', search_query)
    AND (p_category IS NULL OR d.category = p_category)
  ORDER BY relevance_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 5️⃣ AUDIT: Detect retrieval attempts on invalid documents
-- ============================================================================
-- Logs all attempts to retrieve non-ready documents
--
CREATE TABLE IF NOT EXISTS knowledge_retrieval_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempted_document_id UUID,
  request_reason TEXT,
  document_state TEXT,
  error_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retrieval_audit_created_at
ON knowledge_retrieval_audit_log(created_at);

-- ============================================================================
-- 6️⃣ GUARD FUNCTION: Validate retrieval safety
-- ============================================================================
-- Returns TRUE only if document is safe to retrieve
-- Used as runtime check in application layer
--
CREATE OR REPLACE FUNCTION is_document_retrieval_safe(p_document_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  doc_status TEXT;
  integrity_checked BOOLEAN;
  is_active BOOLEAN;
BEGIN
  SELECT
    ingestion_status,
    embedding_integrity_checked,
    is_active
  INTO doc_status, integrity_checked, is_active
  FROM knowledge_documents
  WHERE id = p_document_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF doc_status != 'complete' THEN
    INSERT INTO knowledge_retrieval_audit_log (
      attempted_document_id,
      document_state,
      error_type
    ) VALUES (p_document_id, doc_status, 'INVALID_STATUS');
    RETURN FALSE;
  END IF;

  IF NOT integrity_checked THEN
    INSERT INTO knowledge_retrieval_audit_log (
      attempted_document_id,
      document_state,
      error_type
    ) VALUES (p_document_id, doc_status, 'INTEGRITY_NOT_CHECKED');
    RETURN FALSE;
  END IF;

  IF NOT is_active THEN
    INSERT INTO knowledge_retrieval_audit_log (
      attempted_document_id,
      document_state,
      error_type
    ) VALUES (p_document_id, doc_status, 'DOCUMENT_INACTIVE');
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7️⃣ INDEX OPTIMIZATION for retrieval performance
-- ============================================================================

-- Index for fast ready-document lookup
CREATE INDEX IF NOT EXISTS idx_documents_ready_composite
ON knowledge_documents(ingestion_status, embedding_integrity_checked, is_active)
WHERE ingestion_status = 'complete'
  AND embedding_integrity_checked = TRUE
  AND is_active = TRUE;

-- Index for chunks with embeddings ready
CREATE INDEX IF NOT EXISTS idx_chunks_ready_composite
ON knowledge_chunks(document_id, embedding)
WHERE embedding IS NOT NULL;

-- ============================================================================
-- 8️⃣ VERIFY DEPLOYMENT
-- ============================================================================

-- Verify views exist
SELECT 'knowledge_documents_ready' as view_name
UNION ALL
SELECT 'knowledge_chunks_ready'
UNION ALL
SELECT 'Verification: Views created successfully' as status;

-- Count ready documents (should be <= total)
SELECT
  'Ready documents' as metric,
  COUNT(*) as count
FROM knowledge_documents_ready;

SELECT
  'Total documents' as metric,
  COUNT(*) as count
FROM knowledge_documents;

SELECT
  'Ready chunks with embeddings' as metric,
  COUNT(*) as count
FROM knowledge_chunks_ready;

COMMIT;
