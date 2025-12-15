-- =====================================================
-- ÉTAPE 1/2 : AJOUT DES TYPES D'UTILISATEURS
-- =====================================================
-- À EXÉCUTER EN PREMIER
-- PostgreSQL nécessite que les nouvelles valeurs enum soient
-- committées avant de pouvoir être utilisées dans les policies
-- =====================================================

-- Ajouter les types manquants à l'enum existant
DO $$
BEGIN
  -- Ajouter 'super_admin' si n'existe pas
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'super_admin' AND enumtypid = 'user_type'::regtype) THEN
    ALTER TYPE user_type ADD VALUE 'super_admin';
    RAISE NOTICE '✓ Type super_admin ajouté';
  ELSE
    RAISE NOTICE 'ℹ Type super_admin existe déjà';
  END IF;
END $$;

DO $$
BEGIN
  -- Ajouter 'technicien' si n'existe pas
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'technicien' AND enumtypid = 'user_type'::regtype) THEN
    ALTER TYPE user_type ADD VALUE 'technicien';
    RAISE NOTICE '✓ Type technicien ajouté';
  ELSE
    RAISE NOTICE 'ℹ Type technicien existe déjà';
  END IF;
END $$;

-- Vérifier les types disponibles
SELECT
  enumlabel as type_utilisateur,
  enumsortorder as ordre
FROM pg_enum
WHERE enumtypid = 'user_type'::regtype
ORDER BY enumsortorder;

-- Message de confirmation
SELECT '✅ ÉTAPE 1/2 TERMINÉE - Exécutez maintenant ÉTAPE_2_RLS_POLICIES.sql' as status;
