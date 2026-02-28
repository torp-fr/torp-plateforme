-- MIGRATION: Add PostgreSQL trigger for automatic Edge Function invocation
-- Purpose: Replace client-side supabase.functions.invoke() with server-side trigger
-- Date: 2026-02-28
-- Architecture: Serverless ingestion pipeline triggered by database INSERT

-- 1. Enable pg_net extension for HTTP calls from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create function that invokes Edge Function via HTTP
-- NOTE: This function uses environment variables set by Supabase
-- - SUPABASE_SERVICE_ROLE_KEY: Service role JWT token
-- - The project ref is available via current_database() or from Supabase settings
CREATE OR REPLACE FUNCTION trigger_rag_ingestion()
RETURNS trigger AS $$
DECLARE
  service_role_key TEXT;
  project_url TEXT;
BEGIN
  -- Get service role key from Supabase environment
  -- This is securely injected by Supabase and accessible in pl/pgsql functions
  service_role_key := current_setting('app.service_role_key');

  -- Get project URL from Supabase environment
  -- Format: https://PROJECT_REF.supabase.co
  project_url := current_setting('app.supabase_url');

  -- Async HTTP POST to Edge Function using pg_net
  -- pg_net is a Postgres extension for making HTTP requests
  -- This call is non-blocking and will retry automatically
  PERFORM net.http_post(
    url := project_url || '/functions/v1/rag-ingestion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'documentId', NEW.id
    )::text,
    timeout_milliseconds := 30000
  );

  RAISE LOG '[TRIGGER] Edge Function invoked for document %', NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger that fires after INSERT with status='pending'
DROP TRIGGER IF EXISTS on_document_pending ON knowledge_documents;

CREATE TRIGGER on_document_pending
AFTER INSERT ON knowledge_documents
FOR EACH ROW
WHEN (NEW.ingestion_status = 'pending')
EXECUTE FUNCTION trigger_rag_ingestion();

-- 4. Documentation
COMMENT ON FUNCTION trigger_rag_ingestion() IS
'Automatically invokes rag-ingestion Edge Function when a document is inserted with ingestion_status=pending.
Replaces client-side supabase.functions.invoke(). Uses pg_net for async HTTP POST with service role authentication.
This is part of the serverless ingestion pipeline architecture where:
  1. Frontend uploads file and inserts DB row
  2. This trigger automatically calls Edge Function
  3. Edge Function performs extraction, OCR, embedding
  4. No CORS, no client involvement, no timing issues.';

COMMENT ON TRIGGER on_document_pending ON knowledge_documents IS
'Triggers server-side document ingestion pipeline. Fires when new document is added with status=pending.
No CORS preflight, no client-side edge invocation, fully server-to-server.';
