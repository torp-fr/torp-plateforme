-- =====================================================
-- SYSTÈME DE PERMISSIONS RLS COMPLET ET DÉFINITIF V2
-- =====================================================
-- Correction: Fonction dans le schéma public au lieu de auth
-- =====================================================

-- Étape 1: Enrichir l'enum user_type avec tous les types nécessaires
-- =====================================================

-- Ajouter les types manquants à l'enum existant
DO $$
BEGIN
  -- Ajouter 'super_admin' si n'existe pas
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'super_admin' AND enumtypid = 'user_type'::regtype) THEN
    ALTER TYPE user_type ADD VALUE 'super_admin';
    RAISE NOTICE 'Type super_admin ajouté';
  END IF;

  -- Ajouter 'technicien' si n'existe pas
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'technicien' AND enumtypid = 'user_type'::regtype) THEN
    ALTER TYPE user_type ADD VALUE 'technicien';
    RAISE NOTICE 'Type technicien ajouté';
  END IF;
END $$;

-- Vérifier les types disponibles
SELECT enumlabel as type_utilisateur, enumsortorder as ordre
FROM pg_enum
WHERE enumtypid = 'user_type'::regtype
ORDER BY enumsortorder;

-- Étape 2: Créer une fonction SECURITY DEFINER pour obtenir le type d'utilisateur
-- Cette fonction bypass les RLS, évitant ainsi la récursion infinie
-- IMPORTANT: Dans le schéma PUBLIC pour éviter les problèmes de permissions
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

-- Tester la fonction
SELECT
  auth.uid() as user_id,
  public.get_user_type() as type_utilisateur;

-- Étape 3: Supprimer toutes les anciennes policies
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

-- Étape 4: Créer les nouvelles policies RLS granulaires
-- =====================================================

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

-- 1. Les utilisateurs ne peuvent PAS supprimer leur propre compte
-- (pour éviter les suppressions accidentelles - utiliser une fonction dédiée)

-- 2. Super-admin peut tout supprimer sauf lui-même
CREATE POLICY "users_delete_super_admin"
ON public.users
FOR DELETE
TO authenticated
USING (
  public.get_user_type() = 'super_admin'
  AND id != auth.uid()
);

-- 3. Admin peut supprimer les profils B2C, B2B, technicien
CREATE POLICY "users_delete_admin"
ON public.users
FOR DELETE
TO authenticated
USING (
  public.get_user_type() = 'admin'
  AND user_type IN ('B2C', 'B2B', 'B2G', 'B2B2C', 'technicien')
);

-- Étape 5: Vérifier les policies créées
-- =====================================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  CASE
    WHEN cmd = 'SELECT' THEN 'Lecture'
    WHEN cmd = 'INSERT' THEN 'Insertion'
    WHEN cmd = 'UPDATE' THEN 'Mise à jour'
    WHEN cmd = 'DELETE' THEN 'Suppression'
    ELSE cmd
  END as operation
FROM pg_policies
WHERE tablename = 'users'
ORDER BY cmd, policyname;

-- Étape 6: Documentation des permissions
-- =====================================================

/*
╔══════════════════════════════════════════════════════════════════════════╗
║                    MATRICE DES PERMISSIONS RLS                           ║
╠══════════════════════════════════════════════════════════════════════════╣
║ TYPE UTILISATEUR │  SELECT   │  INSERT   │  UPDATE   │  DELETE          ║
╠══════════════════════════════════════════════════════════════════════════╣
║ B2C / B2B        │  Son profil seulement                │  ❌           ║
║ (Clients)        │                                                       ║
╠══════════════════════════════════════════════════════════════════════════╣
║ Technicien       │  Son profil + clients (B2C, B2B)     │  ❌           ║
║                  │                                                       ║
╠══════════════════════════════════════════════════════════════════════════╣
║ Admin            │  Tous sauf super_admin               │  B2C, B2B,    ║
║                  │  Peut créer B2C/B2B/technicien       │  technicien   ║
╠══════════════════════════════════════════════════════════════════════════╣
║ Super-admin      │  ✅ TOUT   │  ✅ TOUT  │  ✅ TOUT  │  ✅ TOUT        ║
║                  │            │           │           │  (sauf soi)     ║
╚══════════════════════════════════════════════════════════════════════════╝

RÈGLES SPÉCIALES:
- Aucun utilisateur ne peut changer son propre user_type (sauf admin/super_admin)
- Les utilisateurs standards ne peuvent pas supprimer leur compte (protection)
- Super-admin ne peut pas se supprimer lui-même (protection)
- Admin ne peut pas élever un utilisateur au rang d'admin
- La fonction public.get_user_type() utilise SECURITY DEFINER pour éviter la récursion

HIÉRARCHIE DES PERMISSIONS:
1. Super-admin (accès total)
2. Admin (gestion des utilisateurs standards)
3. Technicien (consultation clients)
4. B2C / B2B (consultation profil uniquement)

CHANGEMENTS V2:
- Fonction créée dans le schéma PUBLIC au lieu de AUTH
- Permissions GRANT ajoutées explicitement
- Policies DROP élargies pour nettoyer toutes les anciennes
*/

-- Fin du script
SELECT '✅ Système de permissions RLS V2 configuré avec succès!' as status;
