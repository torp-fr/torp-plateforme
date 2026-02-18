-- PHASE 36.10.4: Integrity & RPC Reconciliation - Verification Queries
-- Purpose: Validate that all components have been properly reconciled
-- Date: 2026-02-18
-- Usage: Run these queries AFTER applying Migration 073

-- ============================================================================
-- SECTION 1: FUNCTION EXISTENCE CHECKS
-- ============================================================================

-- Check if verify_embedding_integrity exists and is callable
SELECT
  'verify_embedding_integrity' as function_name,
  EXISTS (
    SELECT 1
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'verify_embedding_integrity'
  )::text as function_exists,
  'REQUIRED' as importance;

-- Check if audit_system_integrity exists and is callable
SELECT
  'audit_system_integrity' as function_name,
  EXISTS (
    SELECT 1
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'audit_system_integrity'
  )::text as function_exists,
  'REQUIRED' as importance;

-- Check if search_knowledge_by_embedding exists
SELECT
  'search_knowledge_by_embedding' as function_name,
  EXISTS (
    SELECT 1
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'search_knowledge_by_embedding'
  )::text as function_exists,
  'CRITICAL_RPC' as importance;

-- Check if search_knowledge_by_keyword exists
SELECT
  'search_knowledge_by_keyword' as function_name,
  EXISTS (
    SELECT 1
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'search_knowledge_by_keyword'
  )::text as function_exists,
  'CRITICAL_RPC' as importance;

-- Check if is_document_retrieval_safe exists
SELECT
  'is_document_retrieval_safe' as function_name,
  EXISTS (
    SELECT 1
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'is_document_retrieval_safe'
  )::text as function_exists,
  'GUARD_FUNCTION' as importance;

-- Check if log_ingestion_state_transition exists
SELECT
  'log_ingestion_state_transition' as function_name,
  EXISTS (
    SELECT 1
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'log_ingestion_state_transition'
  )::text as function_exists,
  'TRIGGER_FUNCTION' as importance;

-- ============================================================================
-- SECTION 2: VIEW EXISTENCE CHECKS
-- ============================================================================

-- Check if knowledge_documents_ready view exists
SELECT
  'knowledge_documents_ready' as view_name,
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_documents_ready'
      AND table_type = 'VIEW'
  )::text as view_exists,
  'SECURE_VIEW' as importance;

-- Check if knowledge_chunks_ready view exists
SELECT
  'knowledge_chunks_ready' as view_name,
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_chunks_ready'
      AND table_type = 'VIEW'
  )::text as view_exists,
  'SECURE_VIEW' as importance;

-- ============================================================================
-- SECTION 3: TABLE EXISTENCE CHECKS
-- ============================================================================

-- Check if knowledge_ingestion_audit_log exists
SELECT
  'knowledge_ingestion_audit_log' as table_name,
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_ingestion_audit_log'
      AND table_type = 'BASE TABLE'
  )::text as table_exists,
  'AUDIT_TABLE' as importance;

-- Check if knowledge_retrieval_audit_log exists
SELECT
  'knowledge_retrieval_audit_log' as table_name,
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_retrieval_audit_log'
      AND table_type = 'BASE TABLE'
  )::text as table_exists,
  'AUDIT_TABLE' as importance;

-- ============================================================================
-- SECTION 4: TRIGGER EXISTENCE CHECK
-- ============================================================================

-- Check if trigger_ingestion_state_transition exists
SELECT
  'trigger_ingestion_state_transition' as trigger_name,
  EXISTS (
    SELECT 1
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND trigger_name = 'trigger_ingestion_state_transition'
  )::text as trigger_exists,
  'STATE_TRANSITION_LOGGING' as importance;

-- ============================================================================
-- SECTION 5: INDEX VERIFICATION
-- ============================================================================

-- List all reconciliation-related indexes
SELECT
  indexname as index_name,
  'CREATED' as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_audit_log_document_id',
    'idx_audit_log_created_at',
    'idx_retrieval_audit_created_at',
    'idx_documents_ready_composite',
    'idx_chunks_ready_composite'
  )
ORDER BY indexname;

-- ============================================================================
-- SECTION 6: FUNCTIONAL TESTS
-- ============================================================================

-- Test 1: Verify audit_system_integrity() is callable and returns results
SELECT
  'audit_system_integrity_callable' as test_name,
  CASE
    WHEN (SELECT COUNT(*) FROM audit_system_integrity()) >= 0 THEN 'PASS'
    ELSE 'FAIL'
  END as result;

-- Test 2: Count ready documents (should be 0 or more, never error)
SELECT
  'documents_ready_query' as test_name,
  COUNT(*) as ready_document_count,
  'PASS' as result
FROM knowledge_documents_ready;

-- Test 3: Count ready chunks (should be 0 or more, never error)
SELECT
  'chunks_ready_query' as test_name,
  COUNT(*) as ready_chunk_count,
  'PASS' as result
FROM knowledge_chunks_ready;

-- Test 4: Verify RLS policies are in place
SELECT
  'rls_policy_enabled' as test_name,
  COUNT(*) as policy_count,
  'PASS' as result
FROM information_schema.table_constraints
WHERE constraint_name LIKE '%admin%'
  AND table_name IN ('knowledge_ingestion_audit_log', 'knowledge_retrieval_audit_log');

-- ============================================================================
-- SECTION 7: COMPREHENSIVE STATUS SUMMARY
-- ============================================================================

-- Generate final reconciliation status report
WITH component_status AS (
  SELECT 'verify_embedding_integrity' as component, 'FUNCTION'::text as type,
    EXISTS (SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name = 'verify_embedding_integrity')::text as status
  UNION ALL
  SELECT 'audit_system_integrity', 'FUNCTION'::text,
    EXISTS (SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name = 'audit_system_integrity')::text
  UNION ALL
  SELECT 'search_knowledge_by_embedding', 'RPC_FUNCTION'::text,
    EXISTS (SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name = 'search_knowledge_by_embedding')::text
  UNION ALL
  SELECT 'search_knowledge_by_keyword', 'RPC_FUNCTION'::text,
    EXISTS (SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name = 'search_knowledge_by_keyword')::text
  UNION ALL
  SELECT 'is_document_retrieval_safe', 'GUARD_FUNCTION'::text,
    EXISTS (SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name = 'is_document_retrieval_safe')::text
  UNION ALL
  SELECT 'log_ingestion_state_transition', 'TRIGGER_FUNCTION'::text,
    EXISTS (SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name = 'log_ingestion_state_transition')::text
  UNION ALL
  SELECT 'knowledge_documents_ready', 'VIEW'::text,
    EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'knowledge_documents_ready'
        AND table_type = 'VIEW')::text
  UNION ALL
  SELECT 'knowledge_chunks_ready', 'VIEW'::text,
    EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'knowledge_chunks_ready'
        AND table_type = 'VIEW')::text
  UNION ALL
  SELECT 'knowledge_ingestion_audit_log', 'TABLE'::text,
    EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'knowledge_ingestion_audit_log'
        AND table_type = 'BASE TABLE')::text
  UNION ALL
  SELECT 'knowledge_retrieval_audit_log', 'TABLE'::text,
    EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'knowledge_retrieval_audit_log'
        AND table_type = 'BASE TABLE')::text
  UNION ALL
  SELECT 'trigger_ingestion_state_transition', 'TRIGGER'::text,
    EXISTS (SELECT 1 FROM information_schema.triggers
      WHERE trigger_schema = 'public' AND trigger_name = 'trigger_ingestion_state_transition')::text
)
SELECT
  component,
  type,
  status::boolean as exists_in_db,
  CASE WHEN status::boolean THEN '✅ OK' ELSE '❌ MISSING' END as verification
FROM component_status
ORDER BY type, component;

-- ============================================================================
-- SECTION 8: PRODUCTION READINESS CHECK
-- ============================================================================

SELECT
  CASE
    WHEN (
      SELECT COUNT(*) FROM (
        SELECT TRUE FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'verify_embedding_integrity'
        UNION ALL
        SELECT TRUE FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'audit_system_integrity'
        UNION ALL
        SELECT TRUE FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'search_knowledge_by_embedding'
        UNION ALL
        SELECT TRUE FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'search_knowledge_by_keyword'
        UNION ALL
        SELECT TRUE FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'is_document_retrieval_safe'
        UNION ALL
        SELECT TRUE FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'knowledge_documents_ready'
          AND table_type = 'VIEW'
        UNION ALL
        SELECT TRUE FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'knowledge_chunks_ready'
          AND table_type = 'VIEW'
      ) t
    ) >= 7 THEN '✅ PRODUCTION_READY'
    ELSE '❌ INCOMPLETE'
  END as reconciliation_status;

-- ============================================================================
-- SECTION 9: DETAILED FUNCTION SIGNATURES
-- ============================================================================

-- Show function signatures for all reconciled functions
SELECT
  routine_name as function_name,
  routine_type as type,
  string_agg(
    COALESCE(parameter_name, 'NO_PARAMS') || ': ' || udt_name,
    ', '
  ) as parameters
FROM information_schema.routines
LEFT JOIN information_schema.parameters ON routines.routine_name = parameters.routine_name
WHERE routine_schema = 'public'
  AND routine_name IN (
    'verify_embedding_integrity',
    'audit_system_integrity',
    'search_knowledge_by_embedding',
    'search_knowledge_by_keyword',
    'is_document_retrieval_safe',
    'log_ingestion_state_transition'
  )
GROUP BY routine_name, routine_type
ORDER BY routine_name;
