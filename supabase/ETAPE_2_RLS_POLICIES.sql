-- =====================================================
-- ÉTAPE 2/2 : CRÉATION DES POLICIES RLS
-- =====================================================
-- À EXÉCUTER APRÈS L'ÉTAPE 1
-- =====================================================

-- Créer une fonction SECURITY DEFINER pour obtenir le type d'utilisateur
-- Cette fonction bypass les RLS, évitant ainsi la récursion infinie
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
  -- Récupérer le type d'utilisateur sans déclencher les RLS
  SELECT user_type INTO v_user_type
  FROM public.users
  WHERE id = auth.uid();

  RETURN COALESCE(v_user_type, 'B2C');
EXCEPTION
  WHEN OTHERS THEN
    -- En cas d'erreur, retourner B2C par défaut
    RETURN 'B2C';
END;
$$;

-- Accorder les permissions d'exécution
GRANT EXECUTE ON FUNCTION public.get_user_type() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_type() TO anon;

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

-- 1. Tout utilisateur peut voir son propre profil
CREATE POLICY "users_select_own"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- 2. Super-admin peut tout voir
CREATE POLICY "users_select_super_admin"
ON public.users
FOR SELECT
TO authenticated
USING (public.get_user_type() = 'super_admin');

-- 3. Admin peut voir tous les profils sauf super_admins
CREATE POLICY "users_select_admin"
ON public.users
FOR SELECT
TO authenticated
USING (
  public.get_user_type() = 'admin'
  AND user_type != 'super_admin'
);

-- 4. Technicien peut voir les profils B2C et B2B (ses clients)
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

-- 1. Tout utilisateur peut créer son propre profil (inscription)
CREATE POLICY "users_insert_own"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- 2. Super-admin peut créer n'importe quel profil
CREATE POLICY "users_insert_super_admin"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (public.get_user_type() = 'super_admin');

-- 3. Admin peut créer des profils B2C, B2B, technicien
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

-- 1. Tout utilisateur peut mettre à jour son propre profil
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
    user_type = (SELECT user_type FROM public.users WHERE id = auth.uid())
    -- Soit c'est un admin/super_admin qui fait la modification
    OR public.get_user_type() IN ('admin', 'super_admin')
  )
);

-- 2. Super-admin peut tout modifier
CREATE POLICY "users_update_super_admin"
ON public.users
FOR UPDATE
TO authenticated
USING (public.get_user_type() = 'super_admin')
WITH CHECK (public.get_user_type() = 'super_admin');

-- 3. Admin peut modifier les profils B2C, B2B, technicien
-- MAIS ne peut pas les élever au rang d'admin
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

-- 1. Super-admin peut tout supprimer sauf lui-même
CREATE POLICY "users_delete_super_admin"
ON public.users
FOR DELETE
TO authenticated
USING (
  public.get_user_type() = 'super_admin'
  AND id != auth.uid()
);

-- 2. Admin peut supprimer les profils B2C, B2B, technicien
CREATE POLICY "users_delete_admin"
ON public.users
FOR DELETE
TO authenticated
USING (
  public.get_user_type() = 'admin'
  AND user_type IN ('B2C', 'B2B', 'B2G', 'B2B2C', 'technicien')
);

-- Vérifier les policies créées
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename = 'users'
ORDER BY cmd, policyname;

-- Message de confirmation
SELECT '✅ ÉTAPE 2/2 TERMINÉE - Système de permissions RLS configuré avec succès!' as status;

/*
╔══════════════════════════════════════════════════════════════════════════╗
║                    MATRICE DES PERMISSIONS RLS                           ║
╠══════════════════════════════════════════════════════════════════════════╣
║ TYPE UTILISATEUR │  SELECT   │  INSERT   │  UPDATE   │  DELETE          ║
╠══════════════════════════════════════════════════════════════════════════╣
║ B2C / B2B        │  Son profil seulement                │  ❌           ║
╠══════════════════════════════════════════════════════════════════════════╣
║ Technicien       │  Son profil + clients (B2C, B2B)     │  ❌           ║
╠══════════════════════════════════════════════════════════════════════════╣
║ Admin            │  Tous sauf super_admin               │  B2C/B2B/     ║
║                  │  Peut créer B2C/B2B/technicien       │  technicien   ║
╠══════════════════════════════════════════════════════════════════════════╣
║ Super-admin      │  ✅ TOUT   │  ✅ TOUT  │  ✅ TOUT  │  ✅ TOUT        ║
║                  │            │           │           │  (sauf soi)     ║
╚══════════════════════════════════════════════════════════════════════════╝
*/
