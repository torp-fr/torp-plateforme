-- =====================================================
-- TORP Storage Configuration and Policies
-- Migration: 006_storage_policies.sql
-- Description: Configuration du storage bucket et policies RLS
-- Date: 2025-11-27
-- =====================================================

-- =====================================================
-- CRÉATION DU BUCKET STORAGE (si n'existe pas)
-- =====================================================

-- Create bucket for devis uploads (public = false for security)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'devis-uploads',
  'devis-uploads',
  false, -- Private bucket, requires authentication
  52428800, -- 50 MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']::text[];

-- =====================================================
-- RLS POLICIES POUR LE STORAGE
-- =====================================================

-- Policy 1: Les utilisateurs authentifiés peuvent uploader leurs propres fichiers
DROP POLICY IF EXISTS "Users can upload their own devis files" ON storage.objects;
CREATE POLICY "Users can upload their own devis files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'devis-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy 2: Les utilisateurs peuvent lire leurs propres fichiers
DROP POLICY IF EXISTS "Users can read their own devis files" ON storage.objects;
CREATE POLICY "Users can read their own devis files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'devis-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy 3: Les utilisateurs peuvent mettre à jour leurs propres fichiers
DROP POLICY IF EXISTS "Users can update their own devis files" ON storage.objects;
CREATE POLICY "Users can update their own devis files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'devis-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy 4: Les utilisateurs peuvent supprimer leurs propres fichiers
DROP POLICY IF EXISTS "Users can delete their own devis files" ON storage.objects;
CREATE POLICY "Users can delete their own devis files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'devis-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy 5: Les admins peuvent lire tous les fichiers
DROP POLICY IF EXISTS "Admins can read all devis files" ON storage.objects;
CREATE POLICY "Admins can read all devis files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'devis-uploads' AND
    is_admin()
  );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON POLICY "Users can upload their own devis files" ON storage.objects IS
  'Permet aux utilisateurs authentifiés d''uploader des fichiers dans leur propre dossier (userId/)';
COMMENT ON POLICY "Users can read their own devis files" ON storage.objects IS
  'Permet aux utilisateurs de lire leurs propres fichiers uploadés';
COMMENT ON POLICY "Admins can read all devis files" ON storage.objects IS
  'Permet aux admins de lire tous les fichiers uploadés';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
