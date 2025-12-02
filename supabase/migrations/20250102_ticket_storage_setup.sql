-- =====================================================
-- CONFIGURATION COMPLÈTE: Système de tickets TORP - Storage
-- Date: 2025-01-02
-- Description: Configure le bucket Storage et les RLS policies
--              pour la génération et partage public des tickets
-- =====================================================

-- =====================================================
-- ÉTAPE 1: Nettoyer les anciennes policies Storage
-- =====================================================

DO $$
BEGIN
  -- Supprimer toutes les policies liées aux tickets
  DROP POLICY IF EXISTS "Authenticated users can upload tickets" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can read tickets" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update tickets" ON storage.objects;
  DROP POLICY IF EXISTS "Public can read all ticket PDFs" ON storage.objects;
  DROP POLICY IF EXISTS "pro_tickets_insert_authenticated" ON storage.objects;
  DROP POLICY IF EXISTS "pro_tickets_select_public" ON storage.objects;
  DROP POLICY IF EXISTS "pro_tickets_update_authenticated" ON storage.objects;
  DROP POLICY IF EXISTS "pro_tickets_delete_authenticated" ON storage.objects;

  RAISE NOTICE '✓ Anciennes policies supprimées';
END $$;

-- =====================================================
-- ÉTAPE 2: Créer les policies RLS pour tickets-torp
-- =====================================================

-- Policy 1: Utilisateurs authentifiés peuvent uploader leurs tickets
CREATE POLICY "tickets_torp_insert_auth"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tickets-torp'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Policy 2: PUBLIC peut lire tous les tickets (pour QR codes)
CREATE POLICY "tickets_torp_select_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'tickets-torp');

-- Policy 3: Utilisateurs authentifiés peuvent mettre à jour leurs tickets
CREATE POLICY "tickets_torp_update_auth"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tickets-torp'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Policy 4: Utilisateurs authentifiés peuvent supprimer leurs tickets
CREATE POLICY "tickets_torp_delete_auth"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tickets-torp'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

RAISE NOTICE '✓ Policies Storage créées pour tickets-torp';

-- =====================================================
-- ÉTAPE 3: Vérification de la configuration
-- =====================================================

DO $$
DECLARE
  policy_count integer;
  bucket_exists boolean;
BEGIN
  -- Vérifier les policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'objects'
  AND policyname LIKE 'tickets_torp%';

  IF policy_count >= 4 THEN
    RAISE NOTICE '✅ % policies Storage configurées', policy_count;
  ELSE
    RAISE WARNING '⚠️ Seulement % policies trouvées (attendu: 4)', policy_count;
  END IF;

  -- Vérifier le bucket
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE name = 'tickets-torp'
  ) INTO bucket_exists;

  IF bucket_exists THEN
    RAISE NOTICE '✅ Bucket tickets-torp existe';
  ELSE
    RAISE WARNING '⚠️ Bucket tickets-torp n''existe pas - créez-le manuellement';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration Storage terminée !';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- AFFICHER LES POLICIES CONFIGURÉES
-- =====================================================

SELECT
  policyname,
  cmd as operation,
  roles,
  CASE
    WHEN qual IS NOT NULL THEN 'USING: ' || qual::text
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check::text
    ELSE 'N/A'
  END as condition
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE 'tickets_torp%'
ORDER BY policyname;
