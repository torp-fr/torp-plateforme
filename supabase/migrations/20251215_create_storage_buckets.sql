-- Migration: create_storage_buckets.sql
-- Crée les buckets Storage pour les documents TORP
-- Version idempotente (DROP IF EXISTS avant CREATE)

-- Bucket 'documents' - Documents privés (devis, contrats, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket 'photos' - Photos chantier
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket 'public' - Fichiers publics (logos, avatars)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public',
  'public',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- RLS Policies pour bucket 'documents'
-- =====================================================

DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
CREATE POLICY "Users can view own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
CREATE POLICY "Users can update own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- RLS Policies pour bucket 'photos'
-- =====================================================

DROP POLICY IF EXISTS "Users can view own photos" ON storage.objects;
CREATE POLICY "Users can view own photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can upload own photos" ON storage.objects;
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update own photos" ON storage.objects;
CREATE POLICY "Users can update own photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- RLS Policies pour bucket 'public' (accès public en lecture)
-- =====================================================

DROP POLICY IF EXISTS "Public files are viewable by everyone" ON storage.objects;
CREATE POLICY "Public files are viewable by everyone"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'public');

DROP POLICY IF EXISTS "Authenticated users can upload public files" ON storage.objects;
CREATE POLICY "Authenticated users can upload public files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'public');

DROP POLICY IF EXISTS "Users can update their public files" ON storage.objects;
CREATE POLICY "Users can update their public files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete their public files" ON storage.objects;
CREATE POLICY "Users can delete their public files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'public'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
