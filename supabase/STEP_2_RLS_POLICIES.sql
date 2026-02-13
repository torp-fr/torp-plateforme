-- =====================================================
-- STEP 2: Créer les fonctions et policies RLS
-- =====================================================
-- À exécuter APRÈS STEP_1 (attendez 30+ secondes)

-- =====================================================
-- CRÉER LES FONCTIONS RLS
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_type()
RETURNS user_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_type user_type;
BEGIN
  SELECT user_type INTO v_user_type
  FROM public.users
  WHERE id = auth.uid();
  RETURN COALESCE(v_user_type, 'B2C');
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'B2C';
END;
$$;

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
  SELECT user_type INTO v_user_type
  FROM public.users
  WHERE id = auth.uid();
  RETURN COALESCE(v_user_type, 'B2C'::user_type);
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'B2C'::user_type;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_type() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_type() TO anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_type() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_type() TO anon;

-- =====================================================
-- SUPPRIMER TOUTES LES ANCIENNES POLICIES
-- =====================================================

DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_delete_own" ON public.users;
DROP POLICY IF EXISTS "users_select_admin" ON public.users;
DROP POLICY IF EXISTS "users_select_all_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_all_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_all_admin" ON public.users;
DROP POLICY IF EXISTS "users_select_super_admin" ON public.users;
DROP POLICY IF EXISTS "users_select_technicien" ON public.users;
DROP POLICY IF EXISTS "users_insert_super_admin" ON public.users;
DROP POLICY IF EXISTS "users_insert_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_super_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_super_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;

-- =====================================================
-- POLICIES DE LECTURE (SELECT)
-- =====================================================

CREATE POLICY "users_select_own"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "users_select_super_admin"
ON public.users
FOR SELECT
TO authenticated
USING (public.get_user_type() = 'super_admin');

CREATE POLICY "users_select_admin"
ON public.users
FOR SELECT
TO authenticated
USING (
  public.get_user_type() = 'admin'
  AND user_type != 'super_admin'
);

CREATE POLICY "users_select_technicien"
ON public.users
FOR SELECT
TO authenticated
USING (
  public.get_user_type() = 'technicien'
  AND user_type IN ('B2C', 'B2B')
);

-- =====================================================
-- POLICIES D'INSERTION (INSERT)
-- =====================================================

CREATE POLICY "users_insert_own"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "users_insert_super_admin"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (public.get_user_type() = 'super_admin');

CREATE POLICY "users_insert_admin"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_type() = 'admin'
  AND user_type IN ('B2C', 'B2B', 'B2G', 'B2B2C', 'technicien')
);

-- =====================================================
-- POLICIES DE MISE À JOUR (UPDATE) - WITH RECURSION FIX
-- =====================================================

CREATE POLICY "users_update_own"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND (
    user_type = public.get_current_user_type()
    OR public.get_user_type() IN ('admin', 'super_admin')
  )
);

CREATE POLICY "users_update_super_admin"
ON public.users
FOR UPDATE
TO authenticated
USING (public.get_user_type() = 'super_admin')
WITH CHECK (public.get_user_type() = 'super_admin');

CREATE POLICY "users_update_admin"
ON public.users
FOR UPDATE
TO authenticated
USING (
  public.get_user_type() = 'admin'
  AND user_type IN ('B2C', 'B2B', 'B2G', 'B2B2C', 'technicien')
)
WITH CHECK (
  public.get_user_type() = 'admin'
  AND user_type IN ('B2C', 'B2B', 'B2G', 'B2B2C', 'technicien')
);

-- =====================================================
-- POLICIES DE SUPPRESSION (DELETE)
-- =====================================================

CREATE POLICY "users_delete_super_admin"
ON public.users
FOR DELETE
TO authenticated
USING (
  public.get_user_type() = 'super_admin'
  AND id != auth.uid()
);

CREATE POLICY "users_delete_admin"
ON public.users
FOR DELETE
TO authenticated
USING (
  public.get_user_type() = 'admin'
  AND user_type IN ('B2C', 'B2B', 'B2G', 'B2B2C', 'technicien')
);

SELECT '✅ STEP 2 TERMINÉE - RLS configuré avec succès!' as status;
