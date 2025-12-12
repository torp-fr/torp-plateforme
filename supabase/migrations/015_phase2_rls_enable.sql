-- =====================================================
-- TORP Security Fixes - PHASE 2: ACTIVER RLS
-- Description: Activer Row Level Security sur les tables
-- Exécuter après Phase 1
-- =====================================================

-- Note: Plusieurs tables référencées dans la version originale n'existent pas:
-- - dpe_records, company_verifications, geographic_distances, technical_norms
-- Cette version corrigée n'active RLS que sur les tables existantes

-- 2.1 market_data - prix du marché (lecture authentifiée)
-- Note: La table s'appelle market_data (pas market_prices)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_data' AND table_schema = 'public') THEN
    ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;

    -- Supprimer les policies existantes pour éviter les conflits
    DROP POLICY IF EXISTS "market_data_select_authenticated" ON public.market_data;
    DROP POLICY IF EXISTS "market_data_insert_admin" ON public.market_data;
    DROP POLICY IF EXISTS "market_data_update_admin" ON public.market_data;

    CREATE POLICY "market_data_select_authenticated" ON public.market_data
      FOR SELECT USING (auth.uid() IS NOT NULL);

    CREATE POLICY "market_data_insert_admin" ON public.market_data
      FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
      );

    CREATE POLICY "market_data_update_admin" ON public.market_data
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
      );
  END IF;
END
$$;

-- 2.2 knowledge_documents - documents RAG (RLS déjà activé dans migration 002)
-- On ajoute juste des policies admin si elles n'existent pas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_documents' AND table_schema = 'public') THEN
    -- Policy admin pour knowledge_documents
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'knowledge_documents' AND policyname = 'knowledge_documents_admin_all'
    ) THEN
      CREATE POLICY "knowledge_documents_admin_all" ON public.knowledge_documents
        FOR ALL USING (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
        );
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_chunks' AND table_schema = 'public') THEN
    -- Policy admin pour knowledge_chunks
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'knowledge_chunks' AND policyname = 'knowledge_chunks_admin_all'
    ) THEN
      CREATE POLICY "knowledge_chunks_admin_all" ON public.knowledge_chunks
        FOR ALL USING (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
        );
    END IF;
  END IF;
END
$$;

-- 2.3 analytics_events - événements analytics
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_events' AND table_schema = 'public') THEN
    ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "analytics_events_select_own" ON public.analytics_events;
    DROP POLICY IF EXISTS "analytics_events_insert_own" ON public.analytics_events;
    DROP POLICY IF EXISTS "analytics_events_select_admin" ON public.analytics_events;

    CREATE POLICY "analytics_events_select_own" ON public.analytics_events
      FOR SELECT USING (auth.uid() = user_id);

    CREATE POLICY "analytics_events_insert_own" ON public.analytics_events
      FOR INSERT WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "analytics_events_select_admin" ON public.analytics_events
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
      );
  END IF;
END
$$;

-- 2.4 user_feedback - retours utilisateurs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_feedback' AND table_schema = 'public') THEN
    ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "user_feedback_select_own" ON public.user_feedback;
    DROP POLICY IF EXISTS "user_feedback_insert_authenticated" ON public.user_feedback;
    DROP POLICY IF EXISTS "user_feedback_select_admin" ON public.user_feedback;

    CREATE POLICY "user_feedback_select_own" ON public.user_feedback
      FOR SELECT USING (auth.uid()::TEXT = user_id::TEXT OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

    CREATE POLICY "user_feedback_insert_authenticated" ON public.user_feedback
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

    CREATE POLICY "user_feedback_select_admin" ON public.user_feedback
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
      );
  END IF;
END
$$;

-- 2.5 devis_analysis_metrics - métriques d'analyse
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'devis_analysis_metrics' AND table_schema = 'public') THEN
    ALTER TABLE public.devis_analysis_metrics ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "devis_analysis_metrics_select_own" ON public.devis_analysis_metrics;
    DROP POLICY IF EXISTS "devis_analysis_metrics_insert_own" ON public.devis_analysis_metrics;
    DROP POLICY IF EXISTS "devis_analysis_metrics_select_admin" ON public.devis_analysis_metrics;

    CREATE POLICY "devis_analysis_metrics_select_own" ON public.devis_analysis_metrics
      FOR SELECT USING (auth.uid() = user_id);

    CREATE POLICY "devis_analysis_metrics_insert_own" ON public.devis_analysis_metrics
      FOR INSERT WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "devis_analysis_metrics_select_admin" ON public.devis_analysis_metrics
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
      );
  END IF;
END
$$;

-- 2.6 torp_tickets - tickets support
-- Note: torp_tickets n'a pas de user_id, on utilise company_id via companies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'torp_tickets' AND table_schema = 'public') THEN
    ALTER TABLE public.torp_tickets ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "torp_tickets_select_own" ON public.torp_tickets;
    DROP POLICY IF EXISTS "torp_tickets_insert_own" ON public.torp_tickets;
    DROP POLICY IF EXISTS "torp_tickets_update_own" ON public.torp_tickets;
    DROP POLICY IF EXISTS "torp_tickets_select_admin" ON public.torp_tickets;

    -- Accès via company_id -> companies.user_id
    CREATE POLICY "torp_tickets_select_own" ON public.torp_tickets
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.companies c WHERE c.id = torp_tickets.company_id AND c.user_id = auth.uid())
      );

    CREATE POLICY "torp_tickets_insert_own" ON public.torp_tickets
      FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.user_id = auth.uid())
      );

    CREATE POLICY "torp_tickets_update_own" ON public.torp_tickets
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.companies c WHERE c.id = torp_tickets.company_id AND c.user_id = auth.uid())
      );

    CREATE POLICY "torp_tickets_select_admin" ON public.torp_tickets
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
      );
  END IF;
END
$$;

-- =====================================================
-- FIN PHASE 2
-- =====================================================
