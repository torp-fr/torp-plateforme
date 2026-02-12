-- ============================================================
-- Migration: Storage bucket for quote uploads (Supabase dev)
-- ============================================================
--
-- Ce fichier configure le bucket de stockage pour les uploads
-- de devis PDF avec les policies RLS appropriées.
--
-- IMPORTANT: Le bucket doit être créé via le Dashboard Supabase
-- AVANT d'exécuter ce script!
--
-- Étapes:
-- 1. Aller dans Supabase Dashboard → Storage → Buckets
-- 2. Cliquer "New bucket"
-- 3. Nom: quote-uploads
-- 4. Public: OUI (décocher "Make it private" - le rendre public)
-- 5. Cliquer "Create bucket"
-- 6. Exécuter ce script pour les policies RLS
--

-- ============================================================
-- Development Policies (Allow all - pour développement uniquement)
-- ============================================================

-- Policy 1: Allow all to read files
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'quote_uploads_allow_read_dev',
  'quote-uploads',
  'SELECT',
  '(bucket_id = ''quote-uploads'')'
)
ON CONFLICT DO NOTHING;

-- Policy 2: Allow all to upload files
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'quote_uploads_allow_insert_dev',
  'quote-uploads',
  'INSERT',
  '(bucket_id = ''quote-uploads'')'
)
ON CONFLICT DO NOTHING;

-- Policy 3: Allow all to update files
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'quote_uploads_allow_update_dev',
  'quote-uploads',
  'UPDATE',
  '(bucket_id = ''quote-uploads'')'
)
ON CONFLICT DO NOTHING;

-- Policy 4: Allow all to delete files
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'quote_uploads_allow_delete_dev',
  'quote-uploads',
  'DELETE',
  '(bucket_id = ''quote-uploads'')'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Production Policies (Restrict by user/company - À configurer)
-- ============================================================

/*
-- POUR LA PRODUCTION - Remplacer les policies ci-dessus par:

-- Policy 1: Users can only read files from their own CCF
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'quote_uploads_allow_read_own',
  'quote-uploads',
  'SELECT',
  $$
  (bucket_id = 'quote-uploads' AND
   (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM ccf WHERE client_email = auth.jwt()->>'email'
   ))
  $$
)
ON CONFLICT DO NOTHING;

-- Policy 2: Users can only upload to their own CCF directory
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'quote_uploads_allow_insert_own',
  'quote-uploads',
  'INSERT',
  $$
  (bucket_id = 'quote-uploads' AND
   (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM ccf WHERE client_email = auth.jwt()->>'email'
   ))
  $$
)
ON CONFLICT DO NOTHING;

-- Policy 3: Users can only delete their own files
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'quote_uploads_allow_delete_own',
  'quote-uploads',
  'DELETE',
  $$
  (bucket_id = 'quote-uploads' AND
   (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM ccf WHERE client_email = auth.jwt()->>'email'
   ))
  $$
)
ON CONFLICT DO NOTHING;
*/

-- ============================================================
-- Verification query
-- ============================================================

-- Vérifier que les policies sont bien créées:
-- SELECT policy_name, definition
-- FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
-- AND definition LIKE '%quote-uploads%';

-- Vérifier que le bucket existe:
-- SELECT name, owner, public FROM storage.buckets WHERE name = 'quote-uploads';
