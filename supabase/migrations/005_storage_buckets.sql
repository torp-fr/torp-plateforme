-- ============================================
-- Migration: Buckets de stockage pour TORP Pro
-- ============================================

-- NOTE: Les buckets de stockage doivent être créés via le Dashboard Supabase
-- ou via l'API Supabase Storage. Ce fichier est une référence.

-- Créer le bucket pro-devis (via Dashboard Storage > New bucket)
-- Nom: pro-devis
-- Public: false (privé)
-- File size limit: 10 MB
-- Allowed MIME types: application/pdf, image/jpeg, image/png

-- ============================================
-- Politiques de stockage (à exécuter dans SQL Editor)
-- ============================================

-- Politique: Les utilisateurs peuvent uploader dans leur dossier company_id
INSERT INTO storage.policies (name, bucket_id, operation, definition)
SELECT
  'Pro users can upload devis',
  'pro-devis',
  'INSERT',
  $$((bucket_id = 'pro-devis'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))$$
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies
  WHERE name = 'Pro users can upload devis' AND bucket_id = 'pro-devis'
);

-- Politique: Les utilisateurs peuvent lire leurs propres fichiers
INSERT INTO storage.policies (name, bucket_id, operation, definition)
SELECT
  'Pro users can read own devis',
  'pro-devis',
  'SELECT',
  $$((bucket_id = 'pro-devis'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))$$
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies
  WHERE name = 'Pro users can read own devis' AND bucket_id = 'pro-devis'
);

-- Politique: Les utilisateurs peuvent supprimer leurs propres fichiers
INSERT INTO storage.policies (name, bucket_id, operation, definition)
SELECT
  'Pro users can delete own devis',
  'pro-devis',
  'DELETE',
  $$((bucket_id = 'pro-devis'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))$$
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies
  WHERE name = 'Pro users can delete own devis' AND bucket_id = 'pro-devis'
);

-- ============================================
-- Instructions manuelles (Dashboard Supabase)
-- ============================================

/*
1. Aller dans Storage > Buckets
2. Cliquer "New bucket"
3. Nom: pro-devis
4. Public: NON (décocher)
5. Cliquer "Create bucket"

6. Aller dans l'onglet "Policies" du bucket
7. Ajouter les politiques suivantes:

   Policy 1 - Upload:
   - Name: allow_company_upload
   - Allowed operation: INSERT
   - Target roles: authenticated
   - Policy definition: (bucket_id = 'pro-devis' AND auth.uid()::text = (storage.foldername(name))[1])

   Policy 2 - Read:
   - Name: allow_company_read
   - Allowed operation: SELECT
   - Target roles: authenticated
   - Policy definition: (bucket_id = 'pro-devis' AND auth.uid()::text = (storage.foldername(name))[1])

   Policy 3 - Delete:
   - Name: allow_company_delete
   - Allowed operation: DELETE
   - Target roles: authenticated
   - Policy definition: (bucket_id = 'pro-devis' AND auth.uid()::text = (storage.foldername(name))[1])
*/
