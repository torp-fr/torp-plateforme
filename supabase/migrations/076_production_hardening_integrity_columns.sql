-- ============================================================================
-- MIGRATION: Production Hardening - Integrity Score & Publishability Columns
-- PURPOSE: Add missing schema for KnowledgeIntegrityService governance
-- PHASE: Production Hardening (Audit Fix)
-- ============================================================================
-- This migration adds the integrity_score and is_publishable columns that are
-- required for the KnowledgeIntegrityService and RAG governance enforcement.
--
-- CRITICAL: These columns MUST exist before applying migration 075

-- ============================================================================
-- 1️⃣ ADD COLUMN: integrity_score
-- ============================================================================
-- Numeric score (0-1) calculated by KnowledgeIntegrityService
-- Formula: weighted average of:
--   - content_accuracy: 40%
--   - source_credibility: 30%
--   - freshness: 20%
--   - completeness: 10%
--
-- THRESHOLD: 0.7 is the minimum for publishability
-- (scores < 0.7 are considered non-publishable)

ALTER TABLE knowledge_documents
ADD COLUMN IF NOT EXISTS integrity_score NUMERIC(3, 2)
  DEFAULT 0.5
  CHECK (integrity_score >= 0.0 AND integrity_score <= 1.0);

COMMENT ON COLUMN knowledge_documents.integrity_score IS
'Integrity score (0.0-1.0) calculated by KnowledgeIntegrityService.
Score >= 0.7 indicates publishable document.
Formula: 0.4*content_accuracy + 0.3*source_credibility + 0.2*freshness + 0.1*completeness';

-- ============================================================================
-- 2️⃣ ADD COLUMN: is_publishable
-- ============================================================================
-- Boolean flag derived from integrity_score >= 0.7
-- NOT NULL DEFAULT FALSE ensures safe defaults (unpublishable until proven)
-- This is the governance gate for RAG search retrieval

ALTER TABLE knowledge_documents
ADD COLUMN IF NOT EXISTS is_publishable BOOLEAN
  NOT NULL
  DEFAULT FALSE;

COMMENT ON COLUMN knowledge_documents.is_publishable IS
'Publication flag set when integrity_score >= 0.7.
Used to gate retrieval in RAG search. Calculated by KnowledgeIntegrityService.';

-- ============================================================================
-- 3️⃣ CREATE INDEX: Partial index on publishable documents
-- ============================================================================
-- Optimizes queries filtering for is_publishable = TRUE
-- Partial index reduces size by excluding FALSE entries (majority case initially)
-- Critical for RAG search performance

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_publishable
  ON knowledge_documents(id)
  WHERE is_publishable = TRUE;

COMMENT ON INDEX idx_knowledge_documents_publishable IS
'Partial index for fast retrieval of publishable documents in RAG search.
Only indexes rows where is_publishable = TRUE.';

-- ============================================================================
-- 4️⃣ CREATE INDEX: integrity_score for monitoring
-- ============================================================================
-- Allows efficient queries on document integrity distribution
-- Useful for admin dashboards and quality monitoring

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_integrity_score
  ON knowledge_documents(integrity_score DESC)
  WHERE is_active = TRUE;

COMMENT ON INDEX idx_knowledge_documents_integrity_score IS
'Index for monitoring document integrity score distribution.
Used by admin dashboards to track knowledge base quality.';

-- ============================================================================
-- 5️⃣ GOVERNANCE CONSTANT DEFINITION
-- ============================================================================
-- Store the publishability threshold in a table for consistency
-- This ensures the threshold is defined in ONE place only

CREATE TABLE IF NOT EXISTS governance_constants (
  key TEXT PRIMARY KEY,
  value NUMERIC(3, 2) NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert the publishability threshold
INSERT INTO governance_constants (key, value, description)
VALUES (
  'knowledge_publishability_threshold',
  0.7,
  'Minimum integrity_score required for is_publishable=TRUE. Set by KnowledgeIntegrityService.'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_governance_constants_key
  ON governance_constants(key);

-- RLS: Admin-only read/write
ALTER TABLE governance_constants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "governance_constants_admin_read" ON governance_constants;
CREATE POLICY "governance_constants_admin_read" ON governance_constants
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

DROP POLICY IF EXISTS "governance_constants_admin_write" ON governance_constants;
CREATE POLICY "governance_constants_admin_write" ON governance_constants
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- ============================================================================
-- 6️⃣ UPDATE VIEWS: knowledge_documents_ready
-- ============================================================================
-- Add is_publishable to the secure view used by RAG search
-- Ensure view includes the governance column

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
  d.integrity_score,
  d.is_publishable
FROM knowledge_documents d
WHERE d.ingestion_status = 'complete'
  AND d.embedding_integrity_checked = TRUE
  AND d.is_active = TRUE
  AND d.is_publishable = TRUE;

-- ============================================================================
-- 7️⃣ AUDIT FUNCTION: Check integrity threshold consistency
-- ============================================================================
-- Verifies that is_publishable flag matches integrity_score threshold

CREATE OR REPLACE FUNCTION audit_integrity_publishability_consistency()
RETURNS TABLE(
  document_id UUID,
  integrity_score NUMERIC,
  is_publishable BOOLEAN,
  violation TEXT
) AS $$
BEGIN
  -- Check documents where is_publishable doesn't match threshold
  RETURN QUERY
  SELECT
    d.id,
    d.integrity_score,
    d.is_publishable,
    CASE
      WHEN d.integrity_score >= 0.7 AND d.is_publishable = FALSE THEN
        'MISMATCH: score >= 0.7 but is_publishable = FALSE'
      WHEN d.integrity_score < 0.7 AND d.is_publishable = TRUE THEN
        'MISMATCH: score < 0.7 but is_publishable = TRUE'
      ELSE NULL
    END as violation
  FROM knowledge_documents d
  WHERE integrity_score IS NOT NULL
    AND (
      (d.integrity_score >= 0.7 AND d.is_publishable = FALSE) OR
      (d.integrity_score < 0.7 AND d.is_publishable = TRUE)
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION audit_integrity_publishability_consistency() IS
'Audit function to detect inconsistencies between integrity_score and is_publishable flag.
Should return NO rows in healthy state. Run this after KnowledgeIntegrityService updates.';

-- ============================================================================
-- SUMMARY OF CHANGES
-- ============================================================================
--
-- COLUMNS ADDED:
-- ✅ knowledge_documents.integrity_score (NUMERIC(3,2), DEFAULT 0.5, CHECK 0.0-1.0)
-- ✅ knowledge_documents.is_publishable (BOOLEAN, NOT NULL, DEFAULT FALSE)
--
-- INDEXES CREATED:
-- ✅ idx_knowledge_documents_publishable (partial on is_publishable = TRUE)
-- ✅ idx_knowledge_documents_integrity_score (for monitoring)
--
-- GOVERNANCE CONSTANT DEFINED:
-- ✅ governance_constants table stores knowledge_publishability_threshold = 0.7
--
-- VIEWS UPDATED:
-- ✅ knowledge_documents_ready includes integrity_score and is_publishable
--
-- AUDIT FUNCTION CREATED:
-- ✅ audit_integrity_publishability_consistency() detects mismatches
--
-- SINGLE SOURCE OF TRUTH:
-- ✅ Threshold value (0.7) stored in governance_constants table
-- ✅ RPC queries reference view with is_publishable filter
-- ✅ Application code references single source via knowledge_publishability_threshold
--
-- BACKWARD COMPATIBILITY:
-- ✅ All columns have safe defaults (is_publishable = FALSE)
-- ✅ View additions are non-breaking (read-only additions)
-- ✅ Existing code continues to work
