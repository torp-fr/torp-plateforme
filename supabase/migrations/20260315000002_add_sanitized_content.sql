-- ============================================================================
-- PHASE 43 — ADD SANITIZED_CONTENT COLUMN TO knowledge_documents
-- Date: 2026-03-15
-- ============================================================================
-- Context:
--   The ingestion pipeline (knowledgeStepRunner.service.ts) extracts document
--   text and stores both the raw text and sanitized (cleaned) text in the
--   knowledge_documents table.
--
--   This migration adds the missing sanitized_content column that stores
--   the cleaned, normalized text after extraction.
--
-- Effects:
--   • Adds sanitized_content TEXT column to knowledge_documents
--   • Column is nullable (allows documents without extraction yet)
--   • Does not affect existing rows (will be NULL for old documents)
--
-- Rollback:
--   ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS sanitized_content;
-- ============================================================================

ALTER TABLE knowledge_documents
  ADD COLUMN IF NOT EXISTS sanitized_content TEXT;

-- Add comment explaining the column purpose
COMMENT ON COLUMN knowledge_documents.sanitized_content IS
  'Cleaned and normalized document text after extraction (Phase 43)';
