-- =====================================================
-- TORP Security Fixes - PHASE 2: ACTIVER RLS
-- Description: Activer Row Level Security sur les tables
-- Exécuter après Phase 1
-- =====================================================

-- 2.1 dpe_records - données DPE (lecture publique, écriture admin)
ALTER TABLE public.dpe_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dpe_records_select_all" ON public.dpe_records
  FOR SELECT USING (true);

CREATE POLICY "dpe_records_insert_admin" ON public.dpe_records
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "dpe_records_update_admin" ON public.dpe_records
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
  );

-- 2.2 company_verifications
ALTER TABLE public.company_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_verifications_select" ON public.company_verifications
  FOR SELECT USING (
    -- L'utilisateur peut voir les vérifications de sa propre entreprise
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_verifications.company_id
      AND c.user_id = auth.uid()
    )
    OR
    -- Ou c'est un admin
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "company_verifications_insert_admin" ON public.company_verifications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
  );

-- 2.3 knowledge_documents - documents RAG (RLS déjà activé dans migration 002)
-- Note: knowledge_documents et knowledge_chunks ont déjà RLS via migration 002
-- On ajoute juste des policies admin si elles n'existent pas

DO $$
BEGIN
  -- Policy admin pour knowledge_documents
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'knowledge_documents' AND policyname = 'knowledge_documents_admin_all'
  ) THEN
    CREATE POLICY "knowledge_documents_admin_all" ON public.knowledge_documents
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
      );
  END IF;

  -- Policy admin pour knowledge_chunks
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'knowledge_chunks' AND policyname = 'knowledge_chunks_admin_all'
  ) THEN
    CREATE POLICY "knowledge_chunks_admin_all" ON public.knowledge_chunks
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
      );
  END IF;
END
$$;

-- 2.4 geographic_distances - distances géographiques (lecture publique)
ALTER TABLE public.geographic_distances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geographic_distances_select_all" ON public.geographic_distances
  FOR SELECT USING (true);

CREATE POLICY "geographic_distances_insert_admin" ON public.geographic_distances
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
  );

-- 2.5 market_prices - prix du marché (lecture authentifiée)
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_prices_select_authenticated" ON public.market_prices
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "market_prices_insert_admin" ON public.market_prices
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "market_prices_update_admin" ON public.market_prices
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
  );

-- 2.6 technical_norms - normes techniques (lecture authentifiée)
ALTER TABLE public.technical_norms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "technical_norms_select_authenticated" ON public.technical_norms
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "technical_norms_insert_admin" ON public.technical_norms
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
  );

-- =====================================================
-- FIN PHASE 2
-- =====================================================
