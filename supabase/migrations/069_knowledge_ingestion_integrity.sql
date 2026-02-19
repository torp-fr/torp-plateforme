-- PHASE 36.10.1: Knowledge Ingestion Integrity Hardening
-- Adds embedding integrity tracking, strict state machine, and audit capabilities

-- 1️⃣ ADD INTEGRITY TRACKING COLUMNS
ALTER TABLE knowledge_documents
ADD COLUMN IF NOT EXISTS ingestion_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS ingestion_progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ingestion_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ingestion_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_ingestion_error TEXT,
ADD COLUMN IF NOT EXISTS last_ingestion_step TEXT,
ADD COLUMN IF NOT EXISTS embedding_integrity_checked BOOLEAN DEFAULT FALSE;

-- 2️⃣ STATE MACHINE CONSTRAINT - VALID INGESTION STATUS
ALTER TABLE knowledge_documents
DROP CONSTRAINT IF EXISTS valid_ingestion_status;

ALTER TABLE knowledge_documents
ADD CONSTRAINT valid_ingestion_status CHECK (
  ingestion_status IN (
    'pending',      -- Document inserted but not processed
    'processing',   -- Pipeline started (atomic claim phase)
    'chunking',     -- Chunk creation in progress
    'embedding',    -- Embedding generation in progress
    'complete',     -- 100% done with integrity verified
    'failed'        -- Error detected (non-recoverable without retry)
  )
);

-- 3️⃣ INTEGRITY CONSTRAINT - Document can only be "complete" if embedding_integrity_checked = TRUE
ALTER TABLE knowledge_documents
DROP CONSTRAINT IF EXISTS complete_requires_integrity_check;

ALTER TABLE knowledge_documents
ADD CONSTRAINT complete_requires_integrity_check CHECK (
  ingestion_status != 'complete' OR embedding_integrity_checked = TRUE
);

-- 4️⃣ PROGRESS CONSTRAINT - Must be 0-100
ALTER TABLE knowledge_documents
ADD CONSTRAINT progress_range CHECK (
  ingestion_progress >= 0 AND ingestion_progress <= 100
);

-- 5️⃣ INTEGRITY INDEXES - Critical for performance and verification
-- Index to find chunks missing embeddings (for integrity checks)
CREATE INDEX IF NOT EXISTS idx_chunks_missing_embeddings
ON knowledge_chunks(document_id)
WHERE embedding IS NULL;

-- Index for complete documents with integrity verified
CREATE INDEX IF NOT EXISTS idx_documents_complete_integrity
ON knowledge_documents(id)
WHERE ingestion_status = 'complete'
AND embedding_integrity_checked = TRUE;

-- Index for failed documents (for retry operations)
CREATE INDEX IF NOT EXISTS idx_documents_failed
ON knowledge_documents(id, last_ingestion_error)
WHERE ingestion_status = 'failed';

-- Index for monitoring processing documents
CREATE INDEX IF NOT EXISTS idx_documents_processing
ON knowledge_documents(id, ingestion_status)
WHERE ingestion_status IN ('pending', 'processing', 'chunking', 'embedding');

-- 6️⃣ AUDIT FUNCTION - Verify system integrity
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
$$ LANGUAGE plpgsql;

-- 7️⃣ SYSTEM INTEGRITY AUDIT FUNCTION - Find all broken documents
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
$$ LANGUAGE plpgsql;

-- 8️⃣ TRIGGER - Audit log for state transitions (optional but recommended)
CREATE TABLE IF NOT EXISTS knowledge_ingestion_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT,
  transition_reason TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_document_id
ON knowledge_ingestion_audit_log(document_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
ON knowledge_ingestion_audit_log(created_at);

-- Function to log state transitions
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

CREATE TRIGGER trigger_ingestion_state_transition
AFTER UPDATE ON knowledge_documents
FOR EACH ROW
EXECUTE FUNCTION log_ingestion_state_transition();

-- 9️⃣ RLS POLICY - Audit log accessible only to admins
ALTER TABLE knowledge_ingestion_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_read_admin" ON knowledge_ingestion_audit_log
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );
