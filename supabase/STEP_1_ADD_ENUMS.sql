-- =====================================================
-- STEP 1: Ajouter les enums user_type
-- =====================================================
-- À exécuter EN PREMIER
-- Attendez ~30 secondes avant d'exécuter STEP_2

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

SELECT '✅ STEP 1 TERMINÉE - Attendez 30 secondes puis exécutez STEP_2_RLS_POLICIES.sql' as status;
