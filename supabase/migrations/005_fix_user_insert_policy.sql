-- =====================================================
-- TORP Fix User Registration
-- Migration: 005_fix_user_insert_policy.sql
-- Description: Restaurer la policy INSERT manquante pour permettre l'inscription
-- Date: 2025-11-27
-- =====================================================

-- =====================================================
-- PROBLÈME DÉTECTÉ:
-- La migration 004 a supprimé la policy INSERT sur la table users
-- qui permettait aux utilisateurs de créer leur profil lors de l'inscription.
-- Le trigger handle_new_user() ne peut plus insérer dans users à cause de RLS.
-- =====================================================

-- Drop policy if exists (pour être idempotent)
DROP POLICY IF EXISTS "Users can create their own profile during registration" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users during signup" ON users;

-- Recréer la policy INSERT pour permettre l'inscription
-- Cette policy permet au trigger handle_new_user() de créer le profil
-- lors de l'inscription d'un nouvel utilisateur
CREATE POLICY "Enable insert for authenticated users during signup"
  ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Ajouter aussi une policy UPDATE pour que les utilisateurs puissent
-- mettre à jour leur propre profil (si elle n'existe pas déjà)
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

CREATE POLICY "Users can update their own profile"
  ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- AMÉLIORATION DU TRIGGER:
-- Ajouter company et phone qui étaient ignorés
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, user_type, company, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'B2C'),
    NEW.raw_user_meta_data->>'company',
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log l'erreur mais ne bloque pas l'inscription auth
  RAISE WARNING 'Failed to create user profile for %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "Enable insert for authenticated users during signup" ON users IS
  'Permet au trigger handle_new_user() de créer le profil utilisateur lors de l''inscription';
COMMENT ON POLICY "Users can update their own profile" ON users IS
  'Permet aux utilisateurs de mettre à jour leur propre profil';
COMMENT ON FUNCTION public.handle_new_user() IS
  'Crée automatiquement le profil utilisateur dans la table users lors de l''inscription. Inclut company et phone.';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
