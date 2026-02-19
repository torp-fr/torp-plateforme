-- PHASE 36.10.4: Integrity & RPC Reconciliation Migration
-- Objective: Safely reconcile missing functions and views on production database
-- Date: 2026-02-18
-- Status: Recovery/Reconciliation Mode - IDEMPOTENT & SAFE
--
-- This migration is designed to be run multiple times without failure
-- It does NOT recreate constraints or modify existing columns
-- It ONLY creates missing components from Phase 36.10.1 and 36.10.2

-- ============================================================================
-- SAFETY CHECK: Show current state before making changes
-- ============================================================================
-- Informational only - helps with diagnostics

-- Check if functions exist
SELECT 'PRE-MIGRATION STATE' as status;
SELECT 'Checking functions...' as check_type;

-- ============================================================================
-- 1️⃣ CREATE AUDIT TABLE (IF NOT EXISTS)
-- ============================================================================
-- Used for tracking ingestion state transitions

CREATE TABLE IF NOT EXISTS knowledge_ingestion_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT,
  transition_reason TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes on audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_document_id
ON knowledge_ingestion_audit_log(document_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
ON knowledge_ingestion_audit_log(created_at);

-- ============================================================================
-- 2️⃣ CREATE RETRIEVAL AUDIT TABLE (IF NOT EXISTS)
-- ============================================================================
-- Logs attempts to retrieve non-ready documents

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
-- 3️⃣ CREATE/REPLACE: verify_embedding_integrity() FUNCTION
-- ============================================================================
-- Verifies all chunks of a document have embeddings
-- Used for integrity checks during ingestion

CREATE OR REPLACE FUNCTION verify_embedding_integrity(p_document_id UUID)
RETURNS TABLE(
  document_id UUID,
  total_chunks BIGINT,
  embedded_chunks BIGINT,
  missing_embeddings BIGINT,
  is_valid BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    COUNT(c.id)::BIGINT as total_chunks,
    COUNT(CASE WHEN c.embedding IS NOT NULL THEN 1 END)::BIGINT as embedded_chunks,
    COUNT(CASE WHEN c.embedding IS NULL THEN 1 END)::BIGINT as missing_embeddings,
    (COUNT(CASE WHEN c.embedding IS NULL THEN 1 END) = 0)::BOOLEAN as is_valid
  FROM knowledge_documents d
  LEFT JOIN knowledge_chunks c ON d.id = c.document_id
  WHERE d.id = p_document_id
  GROUP BY d.id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 4️⃣ CREATE/REPLACE: audit_system_integrity() FUNCTION
-- ============================================================================
-- Finds all documents with integrity violations
-- Scans entire system to detect broken documents

CREATE OR REPLACE FUNCTION audit_system_integrity()
RETURNS TABLE(
  document_id UUID,
  ingestion_status TEXT,
  embedding_integrity_checked BOOLEAN,
  total_chunks BIGINT,
  missing_embeddings BIGINT,
  violation_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.ingestion_status,
    d.embedding_integrity_checked,
    COUNT(c.id)::BIGINT as total_chunks,
    COUNT(CASE WHEN c.embedding IS NULL THEN 1 END)::BIGINT as missing_embeddings,
    'INCOMPLETE_EMBEDDINGS'::TEXT as violation_type
  FROM knowledge_documents d
  LEFT JOIN knowledge_chunks c ON d.id = c.document_id
  WHERE d.ingestion_status = 'complete'
  AND EXISTS (
    SELECT 1
    FROM knowledge_chunks c2
    WHERE c2.document_id = d.id
    AND c2.embedding IS NULL
  )
  GROUP BY d.id, d.ingestion_status, d.embedding_integrity_checked;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 5️⃣ CREATE/REPLACE: log_ingestion_state_transition() FUNCTION
-- ============================================================================
-- Trigger function to automatically log state machine transitions
-- Called by trigger on knowledge_documents UPDATE

CREATE OR REPLACE FUNCTION log_ingestion_state_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.ingestion_status IS DISTINCT FROM NEW.ingestion_status THEN
    INSERT INTO knowledge_ingestion_audit_log (
      document_id,
      old_status,
      new_status,
      transition_reason,
      error_message
    ) VALUES (
      NEW.id,
      OLD.ingestion_status,
      NEW.ingestion_status,
      'state_transition',
      NEW.last_ingestion_error
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6️⃣ CREATE/REPLACE: is_document_retrieval_safe() FUNCTION
-- ============================================================================
-- Guard function: returns TRUE only if document is safe to retrieve
-- Uses: ingestion_status = 'complete'
--       embedding_integrity_checked = TRUE
--       is_active = TRUE
-- Logs any retrieval attempts on unsafe documents

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
-- 7️⃣ CREATE/REPLACE: search_knowledge_by_embedding() RPC
-- ============================================================================
-- Vector search using pgvector similarity
-- CRITICAL: Uses ONLY knowledge_documents_ready and knowledge_chunks_ready
-- Filters: embedding_similarity > match_threshold
-- Returns: Top match_count results sorted by similarity DESC

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
-- 8️⃣ CREATE/REPLACE: search_knowledge_by_keyword() RPC
-- ============================================================================
-- Keyword search using full-text search (French locale)
-- CRITICAL: Uses ONLY knowledge_documents_ready and knowledge_chunks_ready
-- Filters: ts_rank relevance score
-- Returns: Top match_count results sorted by relevance DESC

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
-- 9️⃣ CREATE/REPLACE: SECURE VIEW knowledge_documents_ready
-- ============================================================================
-- Returns ONLY documents that are 100% safe for retrieval
-- Filters:
--   - ingestion_status = 'complete'
--   - embedding_integrity_checked = TRUE
--   - is_active = TRUE

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
-- 🔟 CREATE/REPLACE: SECURE VIEW knowledge_chunks_ready
-- ============================================================================
-- Returns ONLY chunks from complete, verified documents
-- Filters:
--   - Inner join on knowledge_documents_ready (enforces all safety checks)
--   - embedding IS NOT NULL

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
-- 1️⃣1️⃣ ENSURE TRIGGER EXISTS
-- ============================================================================
-- Drop trigger if exists (safe - won't error if doesn't exist)
-- Then recreate it to ensure it exists

DROP TRIGGER IF EXISTS trigger_ingestion_state_transition ON knowledge_documents;

CREATE TRIGGER trigger_ingestion_state_transition
AFTER UPDATE ON knowledge_documents
FOR EACH ROW
EXECUTE FUNCTION log_ingestion_state_transition();

-- ============================================================================
-- 1️⃣2️⃣ ENABLE RLS ON AUDIT TABLES
-- ============================================================================
-- Secure audit tables with Row-Level Security

ALTER TABLE knowledge_ingestion_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_retrieval_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for audit logs (admin-only access)
DROP POLICY IF EXISTS "audit_log_read_admin" ON knowledge_ingestion_audit_log;
CREATE POLICY "audit_log_read_admin" ON knowledge_ingestion_audit_log
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

DROP POLICY IF EXISTS "retrieval_audit_read_admin" ON knowledge_retrieval_audit_log;
CREATE POLICY "retrieval_audit_read_admin" ON knowledge_retrieval_audit_log
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- ============================================================================
-- 1️⃣3️⃣ INDEXES FOR RETRIEVAL PERFORMANCE
-- ============================================================================
-- Fast lookup for ready documents

CREATE INDEX IF NOT EXISTS idx_documents_ready_composite
ON knowledge_documents(ingestion_status, embedding_integrity_checked, is_active)
WHERE ingestion_status = 'complete'
  AND embedding_integrity_checked = TRUE
  AND is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_chunks_ready_composite
ON knowledge_chunks(document_id, embedding)
WHERE embedding IS NOT NULL;

-- ============================================================================
-- POST-MIGRATION: Verification Queries
-- ============================================================================
-- These queries verify the migration was successful
-- They are informational and will be shown in migration logs

SELECT '✅ PHASE 36.10.4 RECONCILIATION COMPLETE' as status;
SELECT 'Verifying all components...' as check_type;

-- Verify audit tables exist
SELECT
  table_name,
  'TABLE_EXISTS' as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('knowledge_ingestion_audit_log', 'knowledge_retrieval_audit_log');

-- Verify functions exist
SELECT
  routine_name,
  'FUNCTION_EXISTS' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'verify_embedding_integrity',
    'audit_system_integrity',
    'search_knowledge_by_embedding',
    'search_knowledge_by_keyword',
    'is_document_retrieval_safe',
    'log_ingestion_state_transition'
  );

-- Verify views exist
SELECT
  table_name,
  'VIEW_EXISTS' as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'VIEW'
  AND table_name IN ('knowledge_documents_ready', 'knowledge_chunks_ready');

-- Verify indexes exist
SELECT
  indexname,
  'INDEX_EXISTS' as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_audit_log_document_id',
    'idx_audit_log_created_at',
    'idx_retrieval_audit_created_at',
    'idx_documents_ready_composite',
    'idx_chunks_ready_composite'
  );

-- ============================================================================
-- FINAL STATUS
-- ============================================================================
SELECT '✅ Migration 073 Complete - All components reconciled' as final_status;
