-- MIGRATION: Fix ingestion_status constraint to include 'extracting'
-- Problem: knowledgeStepRunner.service.ts sets ingestion_status = 'extracting'
--          during text extraction, but the existing valid_ingestion_status
--          constraint does not include that value → UPDATE fails with
--          "violates check constraint valid_ingestion_status".
--
-- Fix: Drop and recreate the constraint with all 7 valid values.

ALTER TABLE knowledge_documents
  DROP CONSTRAINT IF EXISTS valid_ingestion_status;

ALTER TABLE knowledge_documents
  ADD CONSTRAINT valid_ingestion_status CHECK (
    ingestion_status IN (
      'pending',     -- Document inserted, not yet processed
      'processing',  -- Pipeline claimed the document
      'extracting',  -- Text is being extracted from Storage
      'chunking',    -- Document is being chunked
      'embedding',   -- Embeddings are being generated
      'complete',    -- Pipeline finished successfully
      'completed',   -- Alias used by legacy code (kept for compatibility)
      'failed'       -- Pipeline error
    )
  );
