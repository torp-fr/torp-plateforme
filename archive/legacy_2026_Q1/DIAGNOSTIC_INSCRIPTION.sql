-- =====================================================
-- DIAGNOSTIC COMPLET : Pourquoi l'inscription échoue
-- =====================================================
-- Exécutez ce script dans Supabase SQL Editor pour diagnostiquer le problème
-- =====================================================

-- =====================================================
-- 1. VÉRIFIER QUE LE TRIGGER EXISTE ET EST ACTIF
-- =====================================================
SELECT
  'TRIGGER CHECK' as test_name,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing,
  action_orientation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- =====================================================
-- 2. VÉRIFIER QUE LA FONCTION handle_new_user EXISTE
-- =====================================================
SELECT
  'FUNCTION CHECK' as test_name,
  proname as function_name,
  prosecdef as is_security_definer,
  provolatile as volatility
FROM pg_proc
WHERE proname = 'handle_new_user';

-- =====================================================
-- 3. VÉRIFIER LES POLICIES INSERT SUR LA TABLE USERS
-- =====================================================
SELECT
  'POLICIES CHECK' as test_name,
  schemaname,
  tablename,
  policyname,
  cmd as command,
  permissive,
  roles,
  qual as using_clause,
  with_check as check_clause
FROM pg_policies
WHERE tablename = 'users' AND cmd = 'INSERT';

-- =====================================================
-- 4. VÉRIFIER LES UTILISATEURS DANS auth.users
-- =====================================================
SELECT
  'AUTH USERS' as test_name,
  id,
  email,
  created_at,
  raw_user_meta_data->>'name' as metadata_name,
  raw_user_meta_data->>'user_type' as metadata_user_type
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- =====================================================
-- 5. VÉRIFIER LES UTILISATEURS DANS public.users
-- =====================================================
SELECT
  'PUBLIC USERS' as test_name,
  id,
  email,
  name,
  user_type,
  created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 5;

-- =====================================================
-- 6. TROUVER LES UTILISATEURS ORPHELINS (dans auth mais pas dans public)
-- =====================================================
SELECT
  'ORPHAN USERS' as test_name,
  a.id,
  a.email,
  a.created_at as auth_created_at,
  a.raw_user_meta_data->>'name' as name_from_metadata
FROM auth.users a
LEFT JOIN public.users u ON a.id = u.id
WHERE u.id IS NULL
ORDER BY a.created_at DESC;

-- =====================================================
-- 7. VÉRIFIER RLS SUR LA TABLE USERS
-- =====================================================
SELECT
  'RLS STATUS' as test_name,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'users';

-- =====================================================
-- 8. TESTER LA FONCTION handle_new_user MANUELLEMENT
-- =====================================================
-- Ce test simule ce qui se passe lors d'une inscription
-- Note: Ceci est juste pour tester, ne créera pas vraiment d'utilisateur
DO $$
DECLARE
  test_id UUID := gen_random_uuid();
  test_email TEXT := 'test_' || floor(random() * 10000)::text || '@example.com';
BEGIN
  RAISE NOTICE 'Test de création de profil...';
  RAISE NOTICE 'Test ID: %', test_id;
  RAISE NOTICE 'Test Email: %', test_email;

  -- Essayer d'insérer directement dans users
  BEGIN
    INSERT INTO public.users (id, email, name, user_type)
    VALUES (test_id, test_email, 'Test User', 'B2C');

    RAISE NOTICE '✓ SUCCESS: Insertion directe dans users fonctionne';

    -- Nettoyer le test
    DELETE FROM public.users WHERE id = test_id;
    RAISE NOTICE '✓ Nettoyage effectué';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ ERREUR lors de l''insertion: %', SQLERRM;
    RAISE NOTICE 'Code erreur: %', SQLSTATE;
  END;
END $$;

-- =====================================================
-- 9. VÉRIFIER LES PERMISSIONS SUR LA TABLE USERS
-- =====================================================
SELECT
  'TABLE PERMISSIONS' as test_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND grantee IN ('postgres', 'authenticated', 'anon', 'service_role');

-- =====================================================
-- FIN DU DIAGNOSTIC
-- =====================================================
-- Partagez TOUS les résultats ci-dessus pour diagnostic complet
-- =====================================================
