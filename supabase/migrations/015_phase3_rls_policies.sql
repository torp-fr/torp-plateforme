-- =====================================================
-- TORP Security Fixes - PHASE 3: POLICIES RLS
-- Description: Ajouter policies pour tables avec RLS sans policy
-- Exécuter après Phase 2
-- =====================================================

-- 3.1 activity_logs - Ajouter policies si elles n'existent pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'activity_logs_select_own'
  ) THEN
    CREATE POLICY "activity_logs_select_own" ON public.activity_logs
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'activity_logs_insert_own'
  ) THEN
    CREATE POLICY "activity_logs_insert_own" ON public.activity_logs
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'activity_logs_select_admin'
  ) THEN
    CREATE POLICY "activity_logs_select_admin" ON public.activity_logs
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
      );
  END IF;
END
$$;

-- =====================================================
-- FIN PHASE 3
-- =====================================================
