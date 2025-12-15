-- =====================================================
-- FIX: Récursion infinie dans les RLS policies
-- =====================================================
-- Problème: La policy "users_select_admin" crée une récursion
-- car elle fait un SELECT sur users pour vérifier le user_type
-- Solution: Supprimer cette policy ou la simplifier
-- =====================================================

-- Supprimer la policy problématique
DROP POLICY IF EXISTS "users_select_admin" ON public.users;

-- Les policies restantes suffisent:
-- - users_select_own: permet à chaque user de voir son propre profil
-- - users_insert_own: permet l'insertion lors de l'inscription
-- - users_update_own: permet la mise à jour de son propre profil

-- Si nécessaire plus tard, nous créerons une approche différente pour les admins
-- (par exemple, une fonction SECURITY DEFINER ou un rôle PostgreSQL dédié)

-- Vérifier les policies restantes
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
