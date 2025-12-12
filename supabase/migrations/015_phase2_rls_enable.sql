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

-- 2.3 knowledge_base - base de connaissances RAG (lecture publique authentifiée)
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_base_select_authenticated" ON public.knowledge_base
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "knowledge_base_insert_admin" ON public.knowledge_base
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "knowledge_base_update_admin" ON public.knowledge_base
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "knowledge_base_delete_admin" ON public.knowledge_base
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_type = 'admin')
  );

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
