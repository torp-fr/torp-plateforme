-- =====================================================
-- FIX: Infinite Recursion in RLS Policy
-- =====================================================
-- Problème: La policy "users_update_own" cause:
-- "infinite recursion detected in policy for relation "users""
--
-- Cause: SELECT user_type FROM public.users WHERE id = auth.uid()
--        déclenche les RLS policies à nouveau
-- =====================================================

-- 1. Créer une fonction SECURITY DEFINER pour obtenir le user_type courant
CREATE OR REPLACE FUNCTION public.get_current_user_type()
RETURNS user_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_type user_type;
BEGIN
  -- Récupérer le type d'utilisateur sans déclencher les RLS
  SELECT user_type INTO v_user_type
  FROM public.users
  WHERE id = auth.uid();

  RETURN COALESCE(v_user_type, 'B2C'::user_type);
EXCEPTION
  WHEN OTHERS THEN
    -- En cas d'erreur, retourner B2C par défaut
    RETURN 'B2C'::user_type;
END;
$$;

-- Accorder les permissions d'exécution
GRANT EXECUTE ON FUNCTION public.get_current_user_type() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_type() TO anon;

-- 2. Supprimer la policy défectueuse
DROP POLICY IF EXISTS "users_update_own" ON public.users;

-- 3. Recréer la policy avec la fonction SECURITY DEFINER
-- Tout utilisateur peut mettre à jour son propre profil
-- MAIS ne peut pas changer son user_type (sauf admin/super_admin)
CREATE POLICY "users_update_own"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND (
    -- Soit l'utilisateur ne change pas son user_type
    user_type = public.get_current_user_type()
    -- Soit c'est un admin/super_admin qui fait la modification
    OR public.get_user_type() IN ('admin', 'super_admin')
  )
);

SELECT '✅ FIX appliqué - Policy RLS "users_update_own" corrigée!' as status;
