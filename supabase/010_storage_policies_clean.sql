-- =====================================================
-- POLICIES RLS POUR STORAGE B2B - VERSION CLEAN
-- =====================================================
-- Ce script supprime d'abord les policies existantes puis les recrée

-- ==========================================
-- NETTOYAGE : Supprimer les policies existantes
-- ==========================================

-- Policies company-documents
DROP POLICY IF EXISTS "Users can list their company documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their company documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their company documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their company documents" ON storage.objects;

-- Policies devis-analyses
DROP POLICY IF EXISTS "Users can list their devis" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their devis" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their devis" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their devis" ON storage.objects;

-- Policies tickets-torp
DROP POLICY IF EXISTS "Anyone can view tickets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload tickets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their tickets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their tickets" ON storage.objects;

-- ==========================================
-- CRÉATION : Nouvelles policies
-- ==========================================

-- ==========================================
-- POLICIES: company-documents (Privé)
-- ==========================================

-- Les utilisateurs peuvent lister leurs propres documents
CREATE POLICY "Users can list their company documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'company-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Les utilisateurs peuvent uploader des documents dans leur dossier
CREATE POLICY "Users can upload their company documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Les utilisateurs peuvent mettre à jour leurs documents
CREATE POLICY "Users can update their company documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Les utilisateurs peuvent supprimer leurs documents
CREATE POLICY "Users can delete their company documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ==========================================
-- POLICIES: devis-analyses (Privé)
-- ==========================================

-- Les utilisateurs peuvent lister leurs propres devis
CREATE POLICY "Users can list their devis"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'devis-analyses'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Les utilisateurs peuvent uploader des devis dans leur dossier
CREATE POLICY "Users can upload their devis"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'devis-analyses'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Les utilisateurs peuvent mettre à jour leurs devis
CREATE POLICY "Users can update their devis"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'devis-analyses'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Les utilisateurs peuvent supprimer leurs devis
CREATE POLICY "Users can delete their devis"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'devis-analyses'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ==========================================
-- POLICIES: tickets-torp (Public)
-- ==========================================

-- Tout le monde peut voir les tickets (bucket public)
CREATE POLICY "Anyone can view tickets"
ON storage.objects FOR SELECT
USING (bucket_id = 'tickets-torp');

-- Seuls les utilisateurs authentifiés peuvent uploader des tickets
CREATE POLICY "Authenticated users can upload tickets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tickets-torp'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Les utilisateurs peuvent mettre à jour leurs tickets
CREATE POLICY "Users can update their tickets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tickets-torp'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Les utilisateurs peuvent supprimer leurs tickets
CREATE POLICY "Users can delete their tickets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tickets-torp'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ==========================================
-- VÉRIFICATION
-- ==========================================

-- Pour vérifier que les 12 policies sont créées
SELECT
  policyname,
  cmd,
  CASE
    WHEN policyname LIKE '%company documents%' THEN 'company-documents'
    WHEN policyname LIKE '%devis%' THEN 'devis-analyses'
    WHEN policyname LIKE '%ticket%' THEN 'tickets-torp'
  END as bucket
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
ORDER BY bucket, cmd, policyname;
