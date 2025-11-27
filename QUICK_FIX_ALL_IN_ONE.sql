-- =====================================================
-- QUICK FIX : Appliquer toutes les corrections d'un coup
-- =====================================================
-- Copiez TOUT ce fichier et exécutez-le dans Supabase SQL Editor
-- Cela appliquera les migrations 005 et 006 en une seule fois
-- =====================================================

-- =====================================================
-- MIGRATION 005 : Fix User Registration
-- =====================================================

-- Restaurer les policies RLS sur users
DROP POLICY IF EXISTS "Users can create their own profile during registration" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users during signup" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

CREATE POLICY "Enable insert for authenticated users during signup"
  ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Améliorer le trigger pour inclure company et phone
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
  RAISE WARNING 'Failed to create user profile for %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MIGRATION 006 : Storage Policies
-- =====================================================

-- Créer le bucket devis-uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'devis-uploads',
  'devis-uploads',
  false,
  52428800, -- 50 MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']::text[];

-- Supprimer anciennes policies si existent
DROP POLICY IF EXISTS "Users can upload their own devis files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own devis files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own devis files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own devis files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all devis files" ON storage.objects;

-- Créer les policies RLS sur storage
CREATE POLICY "Users can upload their own devis files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'devis-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read their own devis files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'devis-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own devis files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'devis-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own devis files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'devis-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can read all devis files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'devis-uploads' AND
    is_admin()
  );

-- =====================================================
-- VÉRIFICATION : Afficher les policies créées
-- =====================================================

-- Policies sur users
SELECT 'USERS POLICIES:' as info;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'users' ORDER BY policyname;

-- Policies sur storage
SELECT 'STORAGE POLICIES:' as info;
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE '%devis%'
ORDER BY policyname;

-- Bucket info
SELECT 'BUCKET INFO:' as info;
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'devis-uploads';

-- =====================================================
-- FIN - Si vous voyez les policies ci-dessus, c'est OK !
-- =====================================================
-- Si aucune erreur, vous pouvez maintenant :
-- 1. Supprimer l'utilisateur de test
-- 2. Créer un nouveau compte
-- 3. Uploader un devis
-- =====================================================
