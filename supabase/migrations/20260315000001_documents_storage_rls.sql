-- =====================================================
-- Storage RLS Policies for 'documents' bucket
-- Migration: 20260315000001_documents_storage_rls.sql
-- Description: Grant authenticated users INSERT and SELECT
--              on the knowledge-base 'documents' bucket.
-- Date: 2026-03-15
-- =====================================================

-- Ensure bucket exists (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50 MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'text/markdown'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

-- ── INSERT policy ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "allow authenticated uploads" ON storage.objects;
CREATE POLICY "allow authenticated uploads"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents');

-- ── SELECT policy ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "allow authenticated read" ON storage.objects;
CREATE POLICY "allow authenticated read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

-- ── UPDATE policy (needed for ingestion status updates) ────────────────────────

DROP POLICY IF EXISTS "allow authenticated update" ON storage.objects;
CREATE POLICY "allow authenticated update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents');

-- ── DELETE policy ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "allow authenticated delete" ON storage.objects;
CREATE POLICY "allow authenticated delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents');

-- ── Service role bypass (for server-side ingestion worker) ─────────────────────
-- service_role already bypasses RLS by default in Supabase.
-- No additional policy needed for rag-worker or Edge Functions using service key.

-- =====================================================
-- END OF MIGRATION
-- =====================================================
