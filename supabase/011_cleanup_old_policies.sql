-- =====================================================
-- NETTOYAGE DES ANCIENNES POLICIES STORAGE (OPTIONNEL)
-- =====================================================
-- Supprime les anciennes policies qui ne font pas partie du module B2B

-- Anciennes policies devis-analyses (doublons)
DROP POLICY IF EXISTS "Users can delete their own devis files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own devis files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all devis files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own devis files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own devis files" ON storage.objects;

-- Anciennes policies génériques (sans bucket spécifique)
DROP POLICY IF EXISTS "Allow users to delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own files" ON storage.objects;

-- Vérification : ne devrait rester que les 12 policies B2B
SELECT
  policyname,
  cmd,
  CASE
    WHEN policyname LIKE '%company%' THEN 'company-documents'
    WHEN policyname LIKE '%devis%' THEN 'devis-analyses'
    WHEN policyname LIKE '%ticket%' THEN 'tickets-torp'
    ELSE 'autre'
  END as bucket
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
ORDER BY bucket, cmd;
