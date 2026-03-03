-- =====================================================
-- FIX TEMPORAIRE : Créer manuellement les profils manquants
-- =====================================================
-- Ce script crée les profils pour les utilisateurs qui existent dans auth.users
-- mais pas dans public.users (utilisateurs "orphelins")
-- =====================================================

-- =====================================================
-- OPTION 1 : Créer les profils manquants (SANS VÉRIFIER LES POLICIES)
-- =====================================================
-- Cette version utilise SECURITY DEFINER pour bypasser RLS temporairement

CREATE OR REPLACE FUNCTION fix_orphan_users()
RETURNS TABLE (
  created_user_id UUID,
  created_user_email TEXT,
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  orphan_record RECORD;
  v_error TEXT;
BEGIN
  -- Parcourir tous les utilisateurs orphelins
  FOR orphan_record IN
    SELECT
      a.id,
      a.email,
      a.raw_user_meta_data->>'name' as name,
      COALESCE((a.raw_user_meta_data->>'user_type')::user_type, 'B2C') as user_type,
      a.raw_user_meta_data->>'company' as company,
      a.raw_user_meta_data->>'phone' as phone
    FROM auth.users a
    LEFT JOIN public.users u ON a.id = u.id
    WHERE u.id IS NULL
  LOOP
    BEGIN
      -- Créer le profil
      INSERT INTO public.users (id, email, name, user_type, company, phone)
      VALUES (
        orphan_record.id,
        orphan_record.email,
        orphan_record.name,
        orphan_record.user_type,
        orphan_record.company,
        orphan_record.phone
      );

      -- Retourner succès
      created_user_id := orphan_record.id;
      created_user_email := orphan_record.email;
      success := TRUE;
      error_message := NULL;
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      -- Retourner l'erreur
      created_user_id := orphan_record.id;
      created_user_email := orphan_record.email;
      success := FALSE;
      error_message := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;

  RETURN;
END;
$$;

-- Exécuter la fonction pour créer les profils
SELECT * FROM fix_orphan_users();

-- Nettoyer la fonction après utilisation
DROP FUNCTION IF EXISTS fix_orphan_users();

-- =====================================================
-- VÉRIFICATION : Lister les utilisateurs créés
-- =====================================================
SELECT
  'VERIFICATION' as status,
  COUNT(*) as total_users_in_public,
  COUNT(DISTINCT u.id) as users_with_profiles
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id;

-- =====================================================
-- VÉRIFIER QU'IL N'Y A PLUS D'ORPHELINS
-- =====================================================
SELECT
  'REMAINING ORPHANS' as status,
  a.id,
  a.email,
  a.created_at
FROM auth.users a
LEFT JOIN public.users u ON a.id = u.id
WHERE u.id IS NULL;

-- =====================================================
-- FIN - Si "REMAINING ORPHANS" est vide, tous les profils sont créés !
-- =====================================================
