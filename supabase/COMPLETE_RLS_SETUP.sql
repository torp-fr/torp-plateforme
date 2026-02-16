-- =====================================================
-- SETUP RLS COMPLET - À EXÉCUTER EN UNE SEULE FOIS
-- =====================================================
-- Ordre correct:
-- 1. Ajouter les types d'utilisateurs enum
-- 2. Créer les fonctions et policies
-- 3. Fixer la récursion infinie

-- =====================================================
-- ÉTAPE 1: AJOUTER LES TYPES D'UTILISATEURS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'super_admin' AND enumtypid = 'user_type'::regtype) THEN
    ALTER TYPE user_type ADD VALUE 'super_admin';
    RAISE NOTICE '✓ Type super_admin ajouté';
  ELSE
    RAISE NOTICE 'ℹ Type super_admin existe déjà';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'technicien' AND enumtypid = 'user_type'::regtype) THEN
    ALTER TYPE user_type ADD VALUE 'technicien';
    RAISE NOTICE '✓ Type technicien ajouté';
  ELSE
    RAISE NOTICE 'ℹ Type technicien existe déjà';
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 2: CRÉER LES FONCTIONS RLS
-- =====================================================

-- Créer une fonction SECURITY DEFINER pour obtenir le type d'utilisateur
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

-- Créer une fonction pour obtenir le user_type courant (pour éviter la récursion)
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
-- ÉTAPE 3: CRÉER/SUPPRIMER LES POLICIES RLS
-- =====================================================

-- Supprimer toutes les anciennes policies
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

-- ========================================
-- POLICIES DE LECTURE (SELECT)
-- ========================================

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

-- ========================================
-- POLICIES D'INSERTION (INSERT)
-- ========================================

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

-- ========================================
-- POLICIES DE MISE À JOUR (UPDATE)
-- ========================================

-- Avec FIX pour éviter la récursion infinie
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

-- ========================================
-- POLICIES DE SUPPRESSION (DELETE)
-- ========================================

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

SELECT '✅ SETUP RLS COMPLET - Système de permissions configuré!' as status;
