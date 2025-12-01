-- =====================================================
-- TORP B2B - Configuration Storage Buckets
-- Migration 008: Buckets pour documents et analyses
-- =====================================================

-- =====================================================
-- 1. CRÉATION DES BUCKETS
-- =====================================================

-- Bucket pour les documents d'entreprise (Kbis, assurances, certifications)
-- Privé : seul le propriétaire peut y accéder
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-documents',
  'company-documents',
  false,
  10485760, -- 10 MB max par fichier
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket pour les devis à analyser
-- Privé : seul le propriétaire peut y accéder
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'devis-analyses',
  'devis-analyses',
  false,
  10485760, -- 10 MB max par fichier
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket pour les tickets TORP générés (PDF + QR codes)
-- Public : accessible via URL publique (pour QR codes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tickets-torp',
  'tickets-torp',
  true,
  5242880, -- 5 MB max par fichier
  ARRAY['application/pdf', 'image/png', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. POLICIES POUR company-documents
-- =====================================================

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

-- =====================================================
-- 3. POLICIES POUR devis-analyses
-- =====================================================

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

-- =====================================================
-- 4. POLICIES POUR tickets-torp (PUBLIC)
-- =====================================================

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

-- =====================================================
-- 5. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE storage.buckets IS 'Buckets de stockage pour le module B2B';

-- =====================================================
-- VÉRIFICATION
-- =====================================================

-- Pour vérifier que les buckets sont créés :
-- SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id LIKE '%company%' OR id LIKE '%devis%' OR id LIKE '%ticket%';

-- Pour vérifier les policies :
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'objects';
