-- PHASE 36.10: Knowledge Documents Ingestion State Machine
-- Adds comprehensive ingestion state tracking and recovery capability

-- Add ingestion state columns
ALTER TABLE knowledge_documents
ADD COLUMN IF NOT EXISTS ingestion_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS ingestion_progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ingestion_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ingestion_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_ingestion_error TEXT,
ADD COLUMN IF NOT EXISTS last_ingestion_step TEXT;

-- Drop old constraint if exists and add new valid state constraint
ALTER TABLE knowledge_documents
DROP CONSTRAINT IF EXISTS valid_ingestion_status;

ALTER TABLE knowledge_documents
ADD CONSTRAINT valid_ingestion_status CHECK (
  ingestion_status IN (
    'pending',     -- Document inserted but not processed
    'processing',  -- Pipeline started
    'chunking',    -- Creating chunks
    'embedding',   -- Generating embeddings
    'complete',    -- 100% finished
    'failed'       -- Error detected
  )
);

-- Add constraints for progress tracking
ALTER TABLE knowledge_documents
ADD CONSTRAINT progress_range CHECK (ingestion_progress >= 0 AND ingestion_progress <= 100);

-- Useful indexes for state queries
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_ingestion_status
  ON knowledge_documents(ingestion_status);

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_ingestion_progress
  ON knowledge_documents(ingestion_progress)
  WHERE ingestion_status != 'complete';

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_failed
  ON knowledge_documents(last_ingestion_error)
  WHERE ingestion_status = 'failed';

-- RLS Policies remain same (inherited from existing policies)
-- No additional policies needed - same admins manage state
