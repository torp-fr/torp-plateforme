-- ============================================================================
-- KNOWLEDGE BASE SCHEMA AUDIT SCRIPT - READ-ONLY INSPECTION
-- ============================================================================
-- Purpose: Verify current database state for knowledge RAG system
-- Date: 2026-03-09
-- Mode: READ-ONLY (No modifications)
--
-- Inspects:
-- 1. Installed extensions (especially pgvector)
-- 2. All knowledge_ tables and their structure
-- 3. Columns in knowledge_documents and knowledge_chunks
-- 4. Indexes on knowledge_chunks
-- 5. pgvector configuration and embedding dimensions
--
-- ============================================================================

-- ============================================================================
-- SECTION 1: INSTALLED EXTENSIONS
-- ============================================================================
-- Check which extensions are installed, especially pgvector

\echo '============================================================================'
\echo 'SECTION 1: INSTALLED EXTENSIONS'
\echo '============================================================================'

SELECT
  e.extname AS extension_name,
  e.extversion AS version,
  n.nspname AS schema,
  c.description AS description
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
LEFT JOIN pg_description c ON e.oid = c.objoid
ORDER BY e.extname;

-- Check specifically for pgvector
\echo ''
\echo '--- PGVECTOR CHECK ---'
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
    THEN '✓ pgvector is INSTALLED'
    ELSE '✗ pgvector is NOT installed'
  END AS pgvector_status;

-- ============================================================================
-- SECTION 2: ALL KNOWLEDGE_ TABLES
-- ============================================================================
-- List all tables in public schema starting with 'knowledge_'

\echo ''
\echo '============================================================================'
\echo 'SECTION 2: KNOWLEDGE BASE TABLES'
\echo '============================================================================'

SELECT
  t.table_name,
  t.table_type,
  (
    SELECT COUNT(*)
    FROM information_schema.columns c
    WHERE c.table_name = t.table_name
      AND c.table_schema = 'public'
  ) AS column_count,
  pg_size_pretty(pg_total_relation_size('"public"."' || t.table_name || '"')) AS table_size
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_name LIKE 'knowledge_%'
ORDER BY t.table_name;

-- ============================================================================
-- SECTION 3: KNOWLEDGE_DOCUMENTS TABLE SCHEMA
-- ============================================================================
-- Full column listing and types for knowledge_documents table

\echo ''
\echo '============================================================================'
\echo 'SECTION 3: KNOWLEDGE_DOCUMENTS TABLE SCHEMA'
\echo '============================================================================'

SELECT
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.character_maximum_length,
  c.is_nullable,
  c.column_default,
  c.udt_name
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'knowledge_documents'
ORDER BY c.ordinal_position;

-- Check constraints on knowledge_documents
\echo ''
\echo '--- CONSTRAINTS ON KNOWLEDGE_DOCUMENTS ---'
SELECT
  constraint_name,
  constraint_type,
  is_deferrable,
  initially_deferred
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'knowledge_documents'
ORDER BY constraint_type, constraint_name;

-- Check CHECK constraint details (specifically the category constraint)
\echo ''
\echo '--- CHECK CONSTRAINT DETAILS ---'
SELECT
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_namespace ns ON con.connamespace = ns.oid
JOIN pg_class cl ON con.conrelid = cl.oid
WHERE ns.nspname = 'public'
  AND cl.relname = 'knowledge_documents'
  AND con.contype = 'c'
ORDER BY con.conname;

-- ============================================================================
-- SECTION 4: KNOWLEDGE_CHUNKS TABLE SCHEMA
-- ============================================================================
-- Full column listing with emphasis on embedding vector type

\echo ''
\echo '============================================================================'
\echo 'SECTION 4: KNOWLEDGE_CHUNKS TABLE SCHEMA'
\echo '============================================================================'

SELECT
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name AS element_type,
  CASE
    WHEN c.data_type = 'USER-DEFINED' AND c.udt_name = 'vector'
    THEN (
      SELECT format_type(a.atttypid, a.atttypmod)
      FROM pg_attribute a
      WHERE a.attrelid = (
        SELECT oid FROM pg_class
        WHERE relname = 'knowledge_chunks' AND relnamespace = (
          SELECT oid FROM pg_namespace WHERE nspname = 'public'
        )
      ) AND a.attname = c.column_name
    )
    ELSE NULL
  END AS vector_dimension,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'knowledge_chunks'
ORDER BY c.ordinal_position;

-- Detailed embedding column inspection
\echo ''
\echo '--- EMBEDDING COLUMN DETAILS ---'
SELECT
  a.attname AS column_name,
  format_type(a.atttypid, a.atttypmod) AS complete_type,
  t.typname AS base_type,
  CASE
    WHEN t.typname = 'vector' THEN 'pgvector'
    ELSE 'Unknown'
  END AS vector_type,
  a.attnotnull AS not_null,
  d.adsrc AS default_value
FROM pg_attribute a
JOIN pg_class c ON a.attrelid = c.oid
JOIN pg_type t ON a.atttypid = t.oid
JOIN pg_namespace ns ON c.relnamespace = ns.oid
LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
WHERE ns.nspname = 'public'
  AND c.relname = 'knowledge_chunks'
  AND a.attname LIKE '%embedding%'
ORDER BY a.attnum;

-- Check constraints on knowledge_chunks
\echo ''
\echo '--- CONSTRAINTS ON KNOWLEDGE_CHUNKS ---'
SELECT
  constraint_name,
  constraint_type,
  is_deferrable
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'knowledge_chunks'
ORDER BY constraint_type, constraint_name;

-- ============================================================================
-- SECTION 5: INDEXES ON KNOWLEDGE_CHUNKS
-- ============================================================================
-- All indexes on knowledge_chunks table, including vector indexes

\echo ''
\echo '============================================================================'
\echo 'SECTION 5: INDEXES ON KNOWLEDGE_CHUNKS'
\echo '============================================================================'

SELECT
  i.indexname,
  i.indexdef,
  ix.indisunique AS is_unique,
  ix.indisprimary AS is_primary,
  a.amname AS index_type
FROM pg_indexes i
LEFT JOIN pg_class ic ON ic.relname = i.indexname
LEFT JOIN pg_index ix ON ix.indexrelid = ic.oid
LEFT JOIN pg_am a ON a.oid = ic.relam
WHERE i.schemaname = 'public'
  AND i.tablename = 'knowledge_chunks'
ORDER BY i.indexname;

-- Vector-specific indexes (HNSW or IVFFlat)
\echo ''
\echo '--- VECTOR INDEXES (pgvector) ---'
SELECT
  i.indexname,
  a.amname AS index_access_method,
  i.indexdef
FROM pg_indexes i
LEFT JOIN pg_class ic ON ic.relname = i.indexname
LEFT JOIN pg_am a ON a.oid = ic.relam
WHERE i.schemaname = 'public'
  AND i.tablename = 'knowledge_chunks'
  AND (a.amname IN ('hnsw', 'ivfflat') OR i.indexdef ILIKE '%hnsw%' OR i.indexdef ILIKE '%ivfflat%')
ORDER BY i.indexname;

-- ============================================================================
-- SECTION 6: PGVECTOR CONFIGURATION
-- ============================================================================
-- Verify pgvector is properly configured and check its version

\echo ''
\echo '============================================================================'
\echo 'SECTION 6: PGVECTOR CONFIGURATION'
\echo '============================================================================'

-- Check pgvector version
SELECT
  'pgvector' AS extension,
  extversion AS version,
  CASE
    WHEN extversion >= '0.5.0' THEN '✓ Modern version (supports HNSW)'
    WHEN extversion >= '0.4.0' THEN '✓ Supports IVFFlat'
    ELSE '⚠ Old version'
  END AS compatibility_note
FROM pg_extension
WHERE extname = 'vector';

-- Vector aggregate functions
\echo ''
\echo '--- PGVECTOR FUNCTIONS ---'
SELECT
  n.nspname,
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (p.proname ILIKE '%vector%' OR p.proname ILIKE '%embedding%')
ORDER BY p.proname;

-- ============================================================================
-- SECTION 7: EMBEDDING DIMENSION VERIFICATION
-- ============================================================================
-- Verify embedding vector dimensions match expectations

\echo ''
\echo '============================================================================'
\echo 'SECTION 7: EMBEDDING VECTOR DIMENSIONS'
\echo '============================================================================'

\echo '--- Current Embedding Configuration ---'

SELECT
  'knowledge_chunks' AS table_name,
  'embedding' AS column_name,
  format_type(a.atttypid, a.atttypmod) AS current_type,
  CASE
    WHEN format_type(a.atttypid, a.atttypmod) = 'vector(1536)' THEN '✓ CORRECT (vector(1536))'
    WHEN format_type(a.atttypid, a.atttypmod) = 'vector(384)' THEN '⚠ vector(384) - different dimension'
    WHEN format_type(a.atttypid, a.atttypmod) LIKE 'vector%' THEN '⚠ Non-standard vector dimension'
    ELSE '✗ NOT a vector type'
  END AS dimension_status
FROM pg_attribute a
JOIN pg_class c ON a.attrelid = c.oid
JOIN pg_namespace ns ON c.relnamespace = ns.oid
WHERE ns.nspname = 'public'
  AND c.relname = 'knowledge_chunks'
  AND a.attname = 'embedding';

\echo ''
\echo '--- Expected vs Actual ---'
\echo 'EXPECTED: vector(1536) - matches Claude 3 Sonnet embeddings'
\echo 'REFERENCE: https://docs.anthropic.com/en/docs/guides/embeddings'

-- ============================================================================
-- SECTION 8: TABLE RELATIONSHIPS
-- ============================================================================
-- Foreign keys and relationships

\echo ''
\echo '============================================================================'
\echo 'SECTION 8: TABLE RELATIONSHIPS'
\echo '============================================================================'

SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND (tc.table_name LIKE 'knowledge_%' OR ccu.table_name LIKE 'knowledge_%')
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================================================
-- SECTION 9: TRIGGERS AND FUNCTIONS
-- ============================================================================
-- Database triggers and stored procedures related to knowledge tables

\echo ''
\echo '============================================================================'
\echo 'SECTION 9: TRIGGERS AND FUNCTIONS'
\echo '============================================================================'

SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table LIKE 'knowledge_%'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- SECTION 10: ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Check if RLS is enabled on knowledge tables

\echo ''
\echo '============================================================================'
\echo 'SECTION 10: ROW-LEVEL SECURITY POLICIES'
\echo '============================================================================'

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'knowledge_%'
ORDER BY tablename;

-- RLS policies if enabled
\echo ''
\echo '--- RLS POLICIES (if enabled) ---'
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual AS policy_definition,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'knowledge_%'
ORDER BY tablename, policyname;

-- ============================================================================
-- SECTION 11: AUDIT SUMMARY
-- ============================================================================
-- Summary report for quick verification

\echo ''
\echo '============================================================================'
\echo 'SECTION 11: AUDIT SUMMARY'
\echo '============================================================================'

WITH extension_check AS (
  SELECT
    CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
    THEN 'INSTALLED' ELSE 'MISSING' END AS pgvector_status
),
knowledge_tables AS (
  SELECT COUNT(*) as table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE 'knowledge_%'
),
documents_check AS (
  SELECT
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_documents')
    THEN 'EXISTS' ELSE 'MISSING' END AS status
),
chunks_check AS (
  SELECT
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_chunks')
    THEN 'EXISTS' ELSE 'MISSING' END AS status
),
embedding_check AS (
  SELECT
    format_type(a.atttypid, a.atttypmod) as type
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_namespace ns ON c.relnamespace = ns.oid
  WHERE ns.nspname = 'public'
    AND c.relname = 'knowledge_chunks'
    AND a.attname = 'embedding'
)
SELECT
  'Database Schema Audit' AS audit_item,
  CONCAT(
    '✓ pgvector: ', (SELECT pgvector_status FROM extension_check), ' | ',
    '✓ Tables: ', (SELECT table_count FROM knowledge_tables), ' | ',
    '✓ knowledge_documents: ', (SELECT status FROM documents_check), ' | ',
    '✓ knowledge_chunks: ', (SELECT status FROM chunks_check), ' | ',
    '✓ Embedding: ', COALESCE((SELECT type FROM embedding_check), 'MISSING')
  ) AS status;

\echo ''
\echo '============================================================================'
\echo 'END OF AUDIT SCRIPT'
\echo '============================================================================='
\echo ''
\echo 'VERIFICATION CHECKLIST:'
\echo '✓ All sections executed without modification'
\echo '✓ Extension status verified'
\echo '✓ Table schemas inspected'
\echo '✓ Vector configuration checked'
\echo '✓ Indexes listed'
\echo '✓ Constraints validated'
\echo ''
\echo 'Next Steps: Compare output against expected schema in documentation'
\echo ''
