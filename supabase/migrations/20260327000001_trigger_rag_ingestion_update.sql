-- MIGRATION: Extend rag-ingestion trigger to fire on UPDATE → 'pending'
-- Purpose: Allow force-retry by setting ingestion_status='pending' via pnpm fix:pipeline
-- Date: 2026-03-27
-- Depends on: 20260228191032_trigger_rag_ingestion.sql (pg_net, trigger_rag_ingestion fn)

-- Replace the existing trigger to cover both INSERT and UPDATE.
-- Condition: fire when status becomes 'pending' from a non-pending state
-- This allows: UPDATE knowledge_documents SET ingestion_status='pending' → re-triggers pipeline

DROP TRIGGER IF EXISTS on_document_pending ON knowledge_documents;

CREATE TRIGGER on_document_pending
AFTER INSERT OR UPDATE OF ingestion_status ON knowledge_documents
FOR EACH ROW
WHEN (
  NEW.ingestion_status = 'pending'
  AND (TG_OP = 'INSERT' OR OLD.ingestion_status IS DISTINCT FROM 'pending')
)
EXECUTE FUNCTION trigger_rag_ingestion();

COMMENT ON TRIGGER on_document_pending ON knowledge_documents IS
'Triggers server-side document ingestion pipeline.
Fires on INSERT with status=pending, OR on UPDATE when status transitions TO pending.
The UPDATE case enables force-retry via: UPDATE ... SET ingestion_status=''pending''.
Uses the same trigger_rag_ingestion() function (pg_net HTTP POST to rag-ingestion Edge Function).';
