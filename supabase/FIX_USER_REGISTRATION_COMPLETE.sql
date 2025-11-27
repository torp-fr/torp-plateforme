-- =====================================================
-- FIX COMPLET: Correction enregistrement utilisateurs
-- =====================================================
-- Ce script corrige le problème d'erreur 406 lors de l'enregistrement
-- en restaurant les policies RLS manquantes et le trigger auto-create
--
-- À EXÉCUTER dans Supabase SQL Editor
-- =====================================================

-- =====================================================
-- ÉTAPE 1: Corriger le trigger auto-create
-- =====================================================

-- Recréer la fonction handle_new_user avec tous les champs
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Créer automatiquement le profil utilisateur
  INSERT INTO public.users (
    id,
    email,
    name,
    user_type,
    company,
    phone,
    email_verified,
    onboarding_completed,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'B2C'),
    NEW.raw_user_meta_data->>'company',
    NEW.raw_user_meta_data->>'phone',
    NEW.email_confirmed_at IS NOT NULL,
    FALSE,
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log l'erreur mais ne bloque pas l'enregistrement dans auth.users
    RAISE WARNING 'Erreur lors de la création du profil utilisateur: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recréer le trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ÉTAPE 2: Restaurer les policies RLS manquantes
-- =====================================================

-- DROP les policies existantes pour repartir de zéro
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can create their own profile during registration" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- SELECT: Les utilisateurs peuvent voir leur propre profil
CREATE POLICY "Users can view their own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- SELECT: Les admins peuvent voir tous les utilisateurs
CREATE POLICY "Admins can view all users"
  ON public.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND user_type = 'admin'
    )
  );

-- INSERT: Les utilisateurs peuvent créer leur propre profil
-- (utilisé en backup si le trigger échoue)
CREATE POLICY "Users can create their own profile"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- UPDATE: Les utilisateurs peuvent mettre à jour leur propre profil
CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- ÉTAPE 3: Vérifications
-- =====================================================

-- Vérifier que le trigger existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'on_auth_user_created'
    AND event_object_table = 'users'
    AND event_object_schema = 'auth'
  ) THEN
    RAISE EXCEPTION 'ERREUR: Le trigger on_auth_user_created n''existe pas!';
  ELSE
    RAISE NOTICE '✓ Trigger on_auth_user_created créé avec succès';
  END IF;
END $$;

-- Vérifier les policies
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO policy_count
  FROM pg_policies
  WHERE tablename = 'users'
  AND schemaname = 'public';

  IF policy_count < 4 THEN
    RAISE WARNING 'ATTENTION: Seulement % policies trouvées (attendu: 4)', policy_count;
  ELSE
    RAISE NOTICE '✓ % policies RLS configurées sur la table users', policy_count;
  END IF;
END $$;

-- Afficher les policies actuelles
SELECT
  policyname as "Policy Name",
  cmd as "Command",
  CASE
    WHEN qual IS NOT NULL THEN 'USING clause present'
    ELSE 'No USING clause'
  END as "Using",
  CASE
    WHEN with_check IS NOT NULL THEN 'WITH CHECK clause present'
    ELSE 'No WITH CHECK'
  END as "With Check"
FROM pg_policies
WHERE tablename = 'users'
AND schemaname = 'public'
ORDER BY policyname;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

RAISE NOTICE '';
RAISE NOTICE '============================================';
RAISE NOTICE 'CORRECTION TERMINÉE AVEC SUCCÈS!';
RAISE NOTICE '============================================';
RAISE NOTICE '';
RAISE NOTICE 'Vous pouvez maintenant tester l''enregistrement d''un nouvel utilisateur.';
RAISE NOTICE '';
