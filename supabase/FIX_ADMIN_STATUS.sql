-- ============================================
-- CORRECTION STATUT ADMIN - DIAGNOSTIC COMPLET
-- ============================================

-- 1. Vérifier l'authentification actuelle
SELECT '=== AUTHENTIFICATION ACTUELLE ===' AS info;
SELECT
  auth.uid() AS "UUID de l'utilisateur connecté",
  current_user AS "Utilisateur PostgreSQL";

-- 2. Lister TOUS les utilisateurs
SELECT '=== TOUS LES UTILISATEURS ===' AS info;
SELECT id, email, user_type, created_at
FROM public.users
ORDER BY created_at DESC;

-- 3. Vérifier les utilisateurs admin
SELECT '=== UTILISATEURS ADMIN ===' AS info;
SELECT id, email, user_type, created_at
FROM public.users
WHERE user_type = 'admin';

-- 4. Tester is_admin() avec votre UUID
-- REMPLACEZ ce UUID par celui affiché en section 1
SELECT '=== TEST is_admin() DIRECT ===' AS info;
SELECT EXISTS (
  SELECT 1 FROM users
  WHERE id = auth.uid()
  AND user_type = 'admin'
) AS "Utilisateur est admin ?";

-- 5. Si auth.uid() est NULL, voici le problème
SELECT '=== DIAGNOSTIC ===' AS info;
SELECT
  CASE
    WHEN auth.uid() IS NULL THEN 'PROBLÈME: Vous n''êtes pas authentifié dans Supabase. La fonction is_admin() ne peut pas fonctionner car auth.uid() est NULL.'
    WHEN EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin') THEN 'OK: Vous êtes admin !'
    ELSE 'PROBLÈME: Votre compte existe mais user_type n''est pas "admin"'
  END AS diagnostic;

-- ============================================
-- SOLUTION SI auth.uid() EST NULL :
-- ============================================
-- Vous devez vous connecter à l'APPLICATION WEB (pas seulement Supabase Dashboard)
-- puis revenir tester is_admin() depuis le SQL Editor.
--
-- Ou alors, utilisez cette requête alternative pour vérifier manuellement :
-- SELECT id, email, user_type FROM users WHERE email = 'votre@email.com';
-- ============================================
