-- CLEANUP: Remove pg_net based trigger architecture

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_document_pending ON knowledge_documents;

-- Drop trigger function
DROP FUNCTION IF EXISTS trigger_rag_ingestion();

-- Optional: Drop pg_net extension if present
DROP EXTENSION IF EXISTS pg_net;
