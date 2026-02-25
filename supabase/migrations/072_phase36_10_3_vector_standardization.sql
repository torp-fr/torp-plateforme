-- PHASE 36.10.3: Vector Standardization & Schema Consolidation
-- Objective: Align database schema with TypeScript expectations
-- Date: 2026-02-18
-- Priority: Zero schema drift before Phase 37

-- ============================================================================
-- 1️⃣ PRE-MIGRATION VERIFICATION (informational only)
-- ============================================================================
-- Before applying changes, verify current state:
-- SELECT data_type FROM information_schema.columns
-- WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding';
-- Expected result: vector(384) or vector(1536)

-- ============================================================================
-- 2️⃣ DROP DEPENDENT INDEXES (safe with IF NOT EXISTS)
-- ============================================================================
-- Must drop indexes before altering column type
DROP INDEX IF EXISTS idx_chunks_ready_composite;
DROP INDEX IF EXISTS idx_chunks_missing_embeddings;
DROP INDEX IF EXISTS idx_knowledge_chunks_embedding_hnsw;

-- ============================================================================
-- 3️⃣ UPGRADE VECTOR DIMENSION FROM 384 TO 1536
-- ============================================================================
-- TypeScript code expects 1536-dimensional embeddings (OpenAI standard)
-- Migration must align database with code expectations
--
ALTER TABLE knowledge_chunks
ALTER COLUMN embedding TYPE VECTOR(1536);

-- ============================================================================
-- 4️⃣ ADD MISSING embedding_generated_at COLUMN
-- ============================================================================
-- TypeScript code (knowledge-brain.service.ts:556) references this column
-- Currently missing from database
-- This is CRITICAL for pipeline integrity tracking
--
ALTER TABLE knowledge_chunks
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP WITH TIME ZONE;

-- Comment for clarity
COMMENT ON COLUMN knowledge_chunks.embedding_generated_at IS
  'Timestamp when embedding vector was generated and stored';

-- ============================================================================
-- 5️⃣ ADD region COLUMN TO knowledge_documents (if missing)
-- ============================================================================
-- Code references options?.region in ingestion pipeline
-- Clarify by adding column if not present
--
ALTER TABLE knowledge_documents
ADD COLUMN IF NOT EXISTS region VARCHAR(100);

-- Comment for clarity
COMMENT ON COLUMN knowledge_documents.region IS
  'Geographic region for document applicability (optional)';

-- ============================================================================
-- 6️⃣ RECREATE CRITICAL INDEXES FOR VECTOR(1536)
-- ============================================================================
-- Indexes must be recreated after type change

-- Index for finding chunks missing embeddings (for integrity checks)
CREATE INDEX IF NOT EXISTS idx_chunks_missing_embeddings
ON knowledge_chunks(document_id)
WHERE embedding IS NULL;

-- Index for efficient vector-based retrieval
CREATE INDEX IF NOT EXISTS idx_chunks_ready_composite
ON knowledge_chunks(document_id, embedding)
WHERE embedding IS NOT NULL;

-- Optional: HNSW index for ultra-fast vector search (requires pgvector extension)
-- Uncomment if pgvector extension is enabled in production
-- CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw
-- ON knowledge_chunks
-- USING hnsw (embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 200);

-- ============================================================================
-- 7️⃣ ADD INDEX FOR region IF USED IN QUERIES
-- ============================================================================
-- Only if region filtering is used in knowledge base queries
-- CREATE INDEX IF NOT EXISTS idx_knowledge_documents_region
-- ON knowledge_documents(region)
-- WHERE region IS NOT NULL;

-- ============================================================================
-- 8️⃣ VERIFICATION QUERIES (run after migration)
-- ============================================================================
-- These queries verify the migration completed successfully
-- Run these to confirm schema alignment:

-- Verify vector dimension changed
-- SELECT data_type FROM information_schema.columns
-- WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding';
-- Expected: 'vector(1536)'

-- Verify embedding_generated_at column exists
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding_generated_at';
-- Expected: 'timestamp with time zone'

-- Verify region column exists
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'knowledge_documents' AND column_name = 'region';
-- Expected: 'character varying'

-- Count chunks by embedding status
-- SELECT
--   COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embeddings,
--   COUNT(*) FILTER (WHERE embedding IS NULL) as without_embeddings,
--   COUNT(*) as total_chunks
-- FROM knowledge_chunks;

-- ============================================================================
-- 9️⃣ SYSTEM INTEGRITY CHECK (run after migration)
-- ============================================================================
-- Verify no documents are in invalid states:
-- SELECT * FROM audit_system_integrity();
-- Expected: Empty result set (no violations)

COMMIT;
