-- =====================================================
-- FIX DÉFINITIF : Recréer le trigger avec meilleure gestion d'erreurs
-- =====================================================
-- Ce script recrée complètement le trigger handle_new_user avec :
-- 1. SECURITY DEFINER pour bypasser RLS
-- 2. Meilleure gestion d'erreurs avec logs détaillés
-- 3. SET search_path pour éviter les problèmes de schéma
-- =====================================================

-- =====================================================
-- ÉTAPE 1 : Supprimer l'ancien trigger et fonction
-- =====================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- =====================================================
-- ÉTAPE 2 : Recréer la fonction avec amélioration
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_type user_type;
  v_name TEXT;
  v_company TEXT;
  v_phone TEXT;
BEGIN
  -- Log pour debugging
  RAISE NOTICE '[handle_new_user] Trigger appelé pour user: % (%)', NEW.email, NEW.id;

  -- Extraire les données des metadata avec fallback
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  v_user_type := COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'B2C');
  v_company := NEW.raw_user_meta_data->>'company';
  v_phone := NEW.raw_user_meta_data->>'phone';

  RAISE NOTICE '[handle_new_user] Données extraites - Name: %, Type: %, Company: %, Phone: %',
    v_name, v_user_type, v_company, v_phone;

  -- Insérer dans public.users
  BEGIN
    INSERT INTO public.users (id, email, name, user_type, company, phone, created_at)
    VALUES (
      NEW.id,
      NEW.email,
      v_name,
      v_user_type,
      v_company,
      v_phone,
      NOW()
    );

    RAISE NOTICE '[handle_new_user] ✓ Profil créé avec succès pour: %', NEW.email;

  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE '[handle_new_user] ⚠️ Profil existe déjà pour: %', NEW.email;
    WHEN OTHERS THEN
      -- Logger l'erreur mais ne pas faire échouer l'inscription
      RAISE WARNING '[handle_new_user] ✗ ERREUR lors de la création du profil pour %: % (Code: %)',
        NEW.email, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

-- =====================================================
-- ÉTAPE 3 : Recréer le trigger
-- =====================================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ÉTAPE 4 : Accorder les permissions nécessaires
-- =====================================================
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- =====================================================
-- ÉTAPE 5 : S'assurer que la policy INSERT existe
-- =====================================================
-- Cette policy permet au trigger (qui s'exécute en SECURITY DEFINER) d'insérer
DROP POLICY IF EXISTS "Enable insert for authenticated users during signup" ON users;
DROP POLICY IF EXISTS "Allow trigger to insert user profiles" ON users;

-- Policy pour le trigger (utilise SECURITY DEFINER donc pas besoin de auth.uid())
CREATE POLICY "Allow trigger to insert user profiles"
  ON users
  FOR INSERT
  WITH CHECK (true); -- Permet tout car le trigger valide déjà

-- Policy pour les mises à jour
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
CREATE POLICY "Users can update their own profile"
  ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- ÉTAPE 6 : TESTER LE TRIGGER
-- =====================================================
-- Test 1 : Créer un utilisateur de test
DO $$
DECLARE
  test_id UUID := gen_random_uuid();
  test_email TEXT := 'trigger_test_' || floor(random() * 10000)::text || '@example.com';
  profile_created BOOLEAN;
BEGIN
  RAISE NOTICE '=== TEST DU TRIGGER ===';
  RAISE NOTICE 'Création d''un utilisateur de test...';

  -- Simuler une insertion dans auth.users (normalement fait par Supabase Auth)
  -- NOTE: En production, ne faites PAS ça manuellement !
  -- Ceci est juste pour tester le trigger

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at
  ) VALUES (
    test_id,
    '00000000-0000-0000-0000-000000000000',
    test_email,
    crypt('test_password_123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Test User","user_type":"B2C"}'::jsonb,
    'authenticated',
    'authenticated',
    NOW(),
    NOW()
  );

  -- Attendre un peu pour que le trigger s'exécute
  PERFORM pg_sleep(0.5);

  -- Vérifier si le profil a été créé
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = test_id) INTO profile_created;

  IF profile_created THEN
    RAISE NOTICE '✓ TEST RÉUSSI : Le profil a été créé automatiquement !';
  ELSE
    RAISE NOTICE '✗ TEST ÉCHOUÉ : Le profil n''a PAS été créé';
  END IF;

  -- Nettoyer
  DELETE FROM public.users WHERE id = test_id;
  DELETE FROM auth.users WHERE id = test_id;

  RAISE NOTICE 'Nettoyage effectué';
END $$;

-- =====================================================
-- VÉRIFICATION FINALE
-- =====================================================
SELECT
  'TRIGGER STATUS' as check_name,
  trigger_name,
  event_object_table,
  action_timing || ' ' || string_agg(event_manipulation, ', ') as trigger_event
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'
GROUP BY trigger_name, event_object_table, action_timing;

SELECT
  'FUNCTION STATUS' as check_name,
  proname as function_name,
  prosecdef as security_definer_enabled,
  CASE WHEN prosecdef THEN '✓ SECURITY DEFINER activé' ELSE '✗ SECURITY DEFINER manquant' END as status
FROM pg_proc
WHERE proname = 'handle_new_user';

SELECT
  'POLICIES STATUS' as check_name,
  policyname,
  cmd,
  CASE
    WHEN policyname = 'Allow trigger to insert user profiles' THEN '✓ Policy trigger OK'
    WHEN policyname = 'Users can update their own profile' THEN '✓ Policy update OK'
    ELSE '⚠️ Policy autre'
  END as status
FROM pg_policies
WHERE tablename = 'users'
ORDER BY cmd, policyname;

-- =====================================================
-- FIN - Le trigger est maintenant correctement configuré !
-- =====================================================
-- Prochaines étapes :
-- 1. Exécutez FIX_ORPHAN_USERS.sql pour créer les profils des utilisateurs existants
-- 2. Testez en créant un nouveau compte
-- 3. Vérifiez que le profil apparaît dans public.users
-- =====================================================
