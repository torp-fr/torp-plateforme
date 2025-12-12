-- =====================================================
-- TORP Security Fixes
-- Migration: 015_security_fixes.sql
-- Description: Correction des erreurs de sécurité Supabase Advisors
-- Date: 2025-12-12
-- =====================================================

-- =====================================================
-- PARTIE 1: SUPPRIMER SECURITY DEFINER DES VUES
-- =====================================================

-- Note: On doit d'abord supprimer puis recréer les vues sans SECURITY DEFINER

-- 1.1 feedback_summary
DROP VIEW IF EXISTS public.feedback_summary CASCADE;
CREATE VIEW public.feedback_summary AS
SELECT
  feedback_type,
  category,
  COUNT(*) as count,
  AVG(satisfaction_score) as avg_satisfaction,
  DATE_TRUNC('day', created_at) as day
FROM public.user_feedback
GROUP BY feedback_type, category, DATE_TRUNC('day', created_at);

COMMENT ON VIEW public.feedback_summary IS 'Vue agrégée des feedbacks - sans SECURITY DEFINER pour respecter RLS';

-- 1.2 analytics_overview
DROP VIEW IF EXISTS public.analytics_overview CASCADE;
CREATE VIEW public.analytics_overview AS
SELECT
  event_type,
  event_category,
  user_type,
  COUNT(*) as event_count,
  DATE_TRUNC('day', created_at) as day
FROM public.analytics_events
GROUP BY event_type, event_category, user_type, DATE_TRUNC('day', created_at);

COMMENT ON VIEW public.analytics_overview IS 'Vue agrégée des événements analytics - sans SECURITY DEFINER';

-- 1.3 torp_score_averages
DROP VIEW IF EXISTS public.torp_score_averages CASCADE;
CREATE VIEW public.torp_score_averages AS
SELECT
  user_type,
  AVG(torp_score_overall) as avg_overall,
  AVG(torp_score_transparency) as avg_transparency,
  AVG(torp_score_offer) as avg_offer,
  AVG(torp_score_robustness) as avg_robustness,
  AVG(torp_score_price) as avg_price,
  COUNT(*) as analysis_count
FROM public.devis_analysis_metrics
GROUP BY user_type;

COMMENT ON VIEW public.torp_score_averages IS 'Moyennes des scores TORP par type utilisateur';

-- 1.4 ticket_stats (pour les tickets TORP pro)
DROP VIEW IF EXISTS public.ticket_stats CASCADE;
CREATE VIEW public.ticket_stats AS
SELECT
  company_id,
  status,
  COUNT(*) as ticket_count,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_resolution_time_seconds
FROM public.torp_tickets
GROUP BY company_id, status;

COMMENT ON VIEW public.ticket_stats IS 'Statistiques des tickets TORP par entreprise';

-- 1.5 v_avis_agregats_entreprise
-- Note: La table companies utilise raison_sociale (pas name), score_moyen, torp_badge
DROP VIEW IF EXISTS public.v_avis_agregats_entreprise CASCADE;
CREATE VIEW public.v_avis_agregats_entreprise AS
SELECT
  c.id as company_id,
  c.raison_sociale as company_name,
  c.siret,
  COUNT(d.id) as total_devis,
  AVG(d.score_total) as avg_score,
  AVG((d.score_entreprise->>'scoreTotal')::DECIMAL) as avg_score_entreprise,
  AVG((d.score_prix->>'scoreTotal')::DECIMAL) as avg_score_prix,
  c.score_moyen as review_score,
  c.torp_badge
FROM public.companies c
LEFT JOIN public.devis d ON d.company_id = c.id
GROUP BY c.id, c.raison_sociale, c.siret, c.score_moyen, c.torp_badge;

COMMENT ON VIEW public.v_avis_agregats_entreprise IS 'Agrégat des avis et scores par entreprise';

-- 1.6 v_prediction_accuracy (pour le système RAG)
DROP VIEW IF EXISTS public.v_prediction_accuracy CASCADE;
CREATE VIEW public.v_prediction_accuracy AS
SELECT
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as total_predictions,
  AVG(CASE WHEN metadata->>'accuracy' IS NOT NULL
      THEN (metadata->>'accuracy')::DECIMAL
      ELSE NULL END) as avg_accuracy
FROM public.analytics_events
WHERE event_type = 'prediction'
GROUP BY DATE_TRUNC('day', created_at);

COMMENT ON VIEW public.v_prediction_accuracy IS 'Précision des prédictions par jour';

-- 1.7 rag_health_dashboard
DROP VIEW IF EXISTS public.rag_health_dashboard CASCADE;
CREATE VIEW public.rag_health_dashboard AS
SELECT
  source_type,
  COUNT(*) as document_count,
  SUM(COALESCE((metadata->>'chunk_count')::INT, 0)) as total_chunks,
  AVG(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) as embedding_coverage
FROM public.knowledge_base
GROUP BY source_type;

COMMENT ON VIEW public.rag_health_dashboard IS 'Dashboard santé du système RAG';

-- 1.8 v_prix_moyens_region
DROP VIEW IF EXISTS public.v_prix_moyens_region CASCADE;
CREATE VIEW public.v_prix_moyens_region AS
SELECT
  region_code,
  category,
  sub_category,
  AVG(price_min) as avg_price_min,
  AVG(price_max) as avg_price_max,
  AVG(price_mean) as avg_price_mean,
  COUNT(*) as sample_count
FROM public.market_prices
GROUP BY region_code, category, sub_category;

COMMENT ON VIEW public.v_prix_moyens_region IS 'Prix moyens par région et catégorie';


-- =====================================================
-- PARTIE 2: ACTIVER RLS SUR LES TABLES PUBLIQUES
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

-- 2.7 spatial_ref_sys est une table système PostGIS - on la laisse accessible
-- mais on ajoute une politique de lecture seule
-- Note: Cette table est généralement gérée par PostGIS, on ne touche pas à RLS


-- =====================================================
-- PARTIE 3: AJOUTER POLICIES POUR TABLES AVEC RLS SANS POLICY
-- =====================================================

-- 3.1 activity_logs
-- Vérifier si la policy existe déjà
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
-- PARTIE 4: CORRIGER search_path DES FONCTIONS
-- Note: On recréé les fonctions avec SET search_path = public
-- =====================================================

-- 4.1 set_updated_at - fonction trigger très utilisée
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4.2 update_updated_at_column (alias)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4.3 update_updated_at (autre alias)
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4.4 is_admin - vérification admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND user_type = 'admin'
  );
END;
$$;

-- 4.5 assign_grade
CREATE OR REPLACE FUNCTION public.assign_grade(score DECIMAL)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN CASE
    WHEN score >= 90 THEN 'A+'
    WHEN score >= 80 THEN 'A'
    WHEN score >= 70 THEN 'B+'
    WHEN score >= 60 THEN 'B'
    WHEN score >= 50 THEN 'C+'
    WHEN score >= 40 THEN 'C'
    WHEN score >= 30 THEN 'D'
    ELSE 'E'
  END;
END;
$$;

-- 4.6 calculate_grade_from_score
CREATE OR REPLACE FUNCTION public.calculate_grade_from_score(score DECIMAL)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN public.assign_grade(score);
END;
$$;

-- 4.7 generate_ticket_code - génération de codes tickets
CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  counter INT;
BEGIN
  counter := 0;
  LOOP
    new_code := 'TORP-' || TO_CHAR(NOW(), 'YYMMDD') || '-' ||
                LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.torp_tickets WHERE ticket_code = new_code
    );

    counter := counter + 1;
    IF counter > 100 THEN
      RAISE EXCEPTION 'Unable to generate unique ticket code';
    END IF;
  END LOOP;

  RETURN new_code;
END;
$$;

-- 4.8 generate_phase0_reference
CREATE OR REPLACE FUNCTION public.generate_phase0_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  year_prefix TEXT;
  seq_num INT;
  new_ref TEXT;
BEGIN
  year_prefix := TO_CHAR(NOW(), 'YY');

  SELECT COALESCE(MAX(
    NULLIF(SUBSTRING(reference_number FROM 'P0-' || year_prefix || '-(\d+)')::INT, 0)
  ), 0) + 1
  INTO seq_num
  FROM public.phase0_projects
  WHERE reference_number LIKE 'P0-' || year_prefix || '-%';

  new_ref := 'P0-' || year_prefix || '-' || LPAD(seq_num::TEXT, 5, '0');
  NEW.reference_number := new_ref;

  RETURN NEW;
END;
$$;

-- 4.9 update_phase0_projects_updated_at
CREATE OR REPLACE FUNCTION public.update_phase0_projects_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$;

-- 4.10 update_company_siren - mise à jour automatique du SIREN
CREATE OR REPLACE FUNCTION public.update_company_siren()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.siret IS NOT NULL AND LENGTH(NEW.siret) >= 9 THEN
    NEW.siren := SUBSTRING(REPLACE(NEW.siret, ' ', '') FROM 1 FOR 9);
  END IF;
  RETURN NEW;
END;
$$;

-- 4.11 track_event - tracking analytics
CREATE OR REPLACE FUNCTION public.track_event(
  p_event_type TEXT,
  p_event_category TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_user_type TEXT;
BEGIN
  SELECT user_type::TEXT INTO v_user_type
  FROM public.users
  WHERE id = auth.uid();

  INSERT INTO public.analytics_events (
    user_id,
    session_id,
    event_type,
    event_category,
    user_type,
    metadata
  ) VALUES (
    auth.uid(),
    COALESCE(current_setting('app.session_id', true), gen_random_uuid()::TEXT),
    p_event_type,
    p_event_category,
    v_user_type,
    p_metadata
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- 4.12 calculate_torp_score
CREATE OR REPLACE FUNCTION public.calculate_torp_score(
  transparency DECIMAL,
  offer DECIMAL,
  robustness DECIMAL,
  price DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  weights RECORD;
BEGIN
  -- Pondération TORP standard
  weights := ROW(0.25, 0.25, 0.25, 0.25);

  RETURN ROUND(
    (transparency * 0.25 + offer * 0.25 + robustness * 0.25 + price * 0.25),
    1
  );
END;
$$;

-- 4.13 determine_zone_proximite
CREATE OR REPLACE FUNCTION public.determine_zone_proximite(distance_km DECIMAL)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN CASE
    WHEN distance_km < 15 THEN 'proximite_immediate'
    WHEN distance_km < 30 THEN 'zone_locale'
    WHEN distance_km < 75 THEN 'zone_departementale'
    WHEN distance_km < 150 THEN 'zone_regionale'
    ELSE 'zone_nationale'
  END;
END;
$$;

-- 4.14 get_coefficient_regional_btp
CREATE OR REPLACE FUNCTION public.get_coefficient_regional_btp(region_code TEXT)
RETURNS DECIMAL
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN CASE region_code
    WHEN '11' THEN 1.15  -- Île-de-France
    WHEN '93' THEN 1.10  -- PACA
    WHEN '84' THEN 1.05  -- Auvergne-Rhône-Alpes
    WHEN '44' THEN 1.03  -- Grand Est
    WHEN '32' THEN 1.02  -- Hauts-de-France
    WHEN '28' THEN 1.00  -- Normandie
    WHEN '52' THEN 1.00  -- Pays de la Loire
    WHEN '53' THEN 0.98  -- Bretagne
    WHEN '75' THEN 1.02  -- Nouvelle-Aquitaine
    WHEN '76' THEN 0.97  -- Occitanie
    ELSE 1.00
  END;
END;
$$;

-- 4.15 update_devis_zone_proximite
CREATE OR REPLACE FUNCTION public.update_devis_zone_proximite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.distance_km IS NOT NULL THEN
    NEW.zone_proximite := public.determine_zone_proximite(NEW.distance_km);
  END IF;
  RETURN NEW;
END;
$$;

-- 4.16 update_devis_coefficient_regional
CREATE OR REPLACE FUNCTION public.update_devis_coefficient_regional()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.chantier_region_code IS NOT NULL THEN
    NEW.coefficient_regional := public.get_coefficient_regional_btp(NEW.chantier_region_code);
    NEW.coefficient_source := 'FFB';
  END IF;
  RETURN NEW;
END;
$$;

-- 4.17 calculate_score_localisation
CREATE OR REPLACE FUNCTION public.calculate_score_localisation(
  distance_km DECIMAL,
  zone TEXT,
  has_local_references BOOLEAN DEFAULT FALSE
)
RETURNS DECIMAL
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  base_score DECIMAL;
  bonus DECIMAL := 0;
BEGIN
  base_score := CASE zone
    WHEN 'proximite_immediate' THEN 100
    WHEN 'zone_locale' THEN 85
    WHEN 'zone_departementale' THEN 70
    WHEN 'zone_regionale' THEN 50
    ELSE 30
  END;

  IF has_local_references THEN
    bonus := 10;
  END IF;

  RETURN LEAST(100, base_score + bonus);
END;
$$;

-- 4.18 Fonctions de cache entreprises
CREATE OR REPLACE FUNCTION public.update_company_cache_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.should_refresh_company_cache(cache_updated_at TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  -- Cache valide 30 jours
  RETURN cache_updated_at IS NULL OR cache_updated_at < (NOW() - INTERVAL '30 days');
END;
$$;

CREATE OR REPLACE FUNCTION public.clean_expired_company_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.company_cache
  WHERE updated_at < (NOW() - INTERVAL '90 days');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.clean_expired_entreprises_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.entreprises_cache
  WHERE updated_at < (NOW() - INTERVAL '90 days');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 4.19 Fonctions RAG
CREATE OR REPLACE FUNCTION public.cleanup_empty_chunks()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.rag_chunks
  WHERE content IS NULL OR TRIM(content) = '';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_orphan_chunks()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.rag_chunks c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.rag_documents d WHERE d.id = c.document_id
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_short_chunks(min_length INTEGER DEFAULT 50)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.rag_chunks
  WHERE LENGTH(content) < min_length;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_no_embedding_chunks()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.rag_chunks
  WHERE embedding IS NULL
  AND created_at < (NOW() - INTERVAL '7 days');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.rag_full_cleanup()
RETURNS TABLE(
  empty_deleted INTEGER,
  orphan_deleted INTEGER,
  short_deleted INTEGER,
  no_embedding_deleted INTEGER
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  empty_deleted := public.cleanup_empty_chunks();
  orphan_deleted := public.cleanup_orphan_chunks();
  short_deleted := public.cleanup_short_chunks();
  no_embedding_deleted := public.cleanup_no_embedding_chunks();

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.rag_document_stats()
RETURNS TABLE(
  total_documents BIGINT,
  total_chunks BIGINT,
  chunks_with_embedding BIGINT,
  avg_chunk_length DECIMAL
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.rag_documents)::BIGINT,
    (SELECT COUNT(*) FROM public.rag_chunks)::BIGINT,
    (SELECT COUNT(*) FROM public.rag_chunks WHERE embedding IS NOT NULL)::BIGINT,
    (SELECT AVG(LENGTH(content))::DECIMAL FROM public.rag_chunks);
END;
$$;

CREATE OR REPLACE FUNCTION public.rag_health_check()
RETURNS TABLE(
  status TEXT,
  documents_count BIGINT,
  chunks_count BIGINT,
  embedding_coverage DECIMAL,
  orphan_chunks BIGINT,
  empty_chunks BIGINT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  doc_count BIGINT;
  chunk_count BIGINT;
  embed_count BIGINT;
  orphan_count BIGINT;
  empty_count BIGINT;
  health_status TEXT;
BEGIN
  SELECT COUNT(*) INTO doc_count FROM public.rag_documents;
  SELECT COUNT(*) INTO chunk_count FROM public.rag_chunks;
  SELECT COUNT(*) INTO embed_count FROM public.rag_chunks WHERE embedding IS NOT NULL;
  SELECT COUNT(*) INTO orphan_count FROM public.rag_chunks c
    WHERE NOT EXISTS (SELECT 1 FROM public.rag_documents d WHERE d.id = c.document_id);
  SELECT COUNT(*) INTO empty_count FROM public.rag_chunks WHERE content IS NULL OR TRIM(content) = '';

  IF chunk_count = 0 THEN
    health_status := 'empty';
  ELSIF orphan_count > 0 OR empty_count > 0 THEN
    health_status := 'needs_cleanup';
  ELSIF embed_count::DECIMAL / NULLIF(chunk_count, 0) < 0.9 THEN
    health_status := 'partial_embeddings';
  ELSE
    health_status := 'healthy';
  END IF;

  RETURN QUERY SELECT
    health_status,
    doc_count,
    chunk_count,
    COALESCE(embed_count::DECIMAL / NULLIF(chunk_count, 0), 0),
    orphan_count,
    empty_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.rag_problematic_documents()
RETURNS TABLE(
  document_id UUID,
  title TEXT,
  chunks_count BIGINT,
  missing_embeddings BIGINT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    COUNT(c.id)::BIGINT,
    COUNT(c.id) FILTER (WHERE c.embedding IS NULL)::BIGINT
  FROM public.rag_documents d
  LEFT JOIN public.rag_chunks c ON c.document_id = d.id
  GROUP BY d.id, d.title
  HAVING COUNT(c.id) FILTER (WHERE c.embedding IS NULL) > 0;
END;
$$;

-- 4.20 Fonctions de recherche vectorielle
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.rag_chunks c
  WHERE c.embedding IS NOT NULL
  AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.hybrid_search_documents(
  query_text TEXT,
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  keyword_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  metadata JSONB,
  combined_score FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.content,
    c.metadata,
    (
      (1 - keyword_weight) * (1 - (c.embedding <=> query_embedding)) +
      keyword_weight * ts_rank(to_tsvector('french', c.content), plainto_tsquery('french', query_text))
    ) AS combined_score
  FROM public.rag_chunks c
  WHERE c.embedding IS NOT NULL
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  source_type TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.content,
    k.source_type,
    1 - (k.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base k
  WHERE k.embedding IS NOT NULL
  AND 1 - (k.embedding <=> query_embedding) > match_threshold
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_knowledge(
  query_text TEXT,
  filter_type TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  source_type TEXT,
  rank FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.content,
    k.source_type,
    ts_rank(to_tsvector('french', k.content), plainto_tsquery('french', query_text)) AS rank
  FROM public.knowledge_base k
  WHERE to_tsvector('french', k.content) @@ plainto_tsquery('french', query_text)
  AND (filter_type IS NULL OR k.source_type = filter_type)
  ORDER BY rank DESC
  LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_market_prices(
  query_embedding vector(1536),
  region TEXT DEFAULT NULL,
  category TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  work_type TEXT,
  price_min DECIMAL,
  price_max DECIMAL,
  similarity FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.sub_category,
    m.price_min,
    m.price_max,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.market_prices m
  WHERE m.embedding IS NOT NULL
  AND (region IS NULL OR m.region_code = region)
  AND (category IS NULL OR m.category = category)
  ORDER BY m.embedding <=> query_embedding
  LIMIT 10;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_technical_norms(
  query_embedding vector(1536),
  norm_type TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  code TEXT,
  title TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.code,
    n.title,
    n.content,
    1 - (n.embedding <=> query_embedding) AS similarity
  FROM public.technical_norms n
  WHERE n.embedding IS NOT NULL
  AND (norm_type IS NULL OR n.norm_type = norm_type)
  ORDER BY n.embedding <=> query_embedding
  LIMIT 10;
END;
$$;

-- 4.21 Fonctions admin
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE(
  id UUID,
  email TEXT,
  name TEXT,
  user_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email, u.name, u.user_type::TEXT, u.created_at
  FROM public.users u
  ORDER BY u.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_all_feedbacks()
RETURNS TABLE(
  id UUID,
  user_email TEXT,
  feedback_type TEXT,
  title TEXT,
  message TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT f.id, f.user_email, f.feedback_type, f.title, f.message, f.status, f.created_at
  FROM public.user_feedback f
  ORDER BY f.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_all_analyses()
RETURNS TABLE(
  id UUID,
  user_id UUID,
  torp_score DECIMAL,
  grade TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT m.id, m.user_id, m.torp_score_overall, m.grade, m.created_at
  FROM public.devis_analysis_metrics m
  ORDER BY m.created_at DESC;
END;
$$;

-- 4.22 Fonctions stats
CREATE OR REPLACE FUNCTION public.get_analytics_stats()
RETURNS TABLE(
  total_events BIGINT,
  unique_users BIGINT,
  events_today BIGINT,
  top_event_type TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COUNT(DISTINCT user_id)::BIGINT,
    COUNT(*) FILTER (WHERE created_at > CURRENT_DATE)::BIGINT,
    (SELECT event_type FROM public.analytics_events
     GROUP BY event_type ORDER BY COUNT(*) DESC LIMIT 1)
  FROM public.analytics_events;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_stats()
RETURNS TABLE(
  total_users BIGINT,
  b2c_users BIGINT,
  b2b_users BIGINT,
  new_today BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE user_type = 'B2C')::BIGINT,
    COUNT(*) FILTER (WHERE user_type = 'B2B')::BIGINT,
    COUNT(*) FILTER (WHERE created_at > CURRENT_DATE)::BIGINT
  FROM public.users;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_knowledge_stats()
RETURNS TABLE(
  total_entries BIGINT,
  entries_by_type JSONB
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    jsonb_object_agg(COALESCE(source_type, 'unknown'), cnt)
  FROM (
    SELECT source_type, COUNT(*) as cnt
    FROM public.knowledge_base
    GROUP BY source_type
  ) sub;
END;
$$;

CREATE OR REPLACE FUNCTION public.torp_stats()
RETURNS TABLE(
  total_analyses BIGINT,
  avg_score DECIMAL,
  grade_distribution JSONB
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    AVG(torp_score_overall),
    jsonb_object_agg(COALESCE(grade, 'N/A'), cnt)
  FROM (
    SELECT grade, COUNT(*) as cnt
    FROM public.devis_analysis_metrics
    GROUP BY grade
  ) sub
  CROSS JOIN (
    SELECT AVG(torp_score_overall) as avg_score, COUNT(*) as total
    FROM public.devis_analysis_metrics
  ) totals;
END;
$$;

-- 4.23 Autres fonctions utilitaires
CREATE OR REPLACE FUNCTION public.update_knowledge_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_text_document(
  doc_content TEXT,
  chunk_size INT DEFAULT 1000,
  chunk_overlap INT DEFAULT 200
)
RETURNS TABLE(
  chunk_index INT,
  chunk_content TEXT
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  doc_length INT;
  current_pos INT := 1;
  chunk_idx INT := 0;
BEGIN
  doc_length := LENGTH(doc_content);

  WHILE current_pos < doc_length LOOP
    chunk_idx := chunk_idx + 1;

    RETURN QUERY SELECT
      chunk_idx,
      SUBSTRING(doc_content FROM current_pos FOR chunk_size);

    current_pos := current_pos + chunk_size - chunk_overlap;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_company_data_quality(company_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  quality_score DECIMAL := 0;
  company_record RECORD;
BEGIN
  SELECT * INTO company_record
  FROM public.companies
  WHERE id = company_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Points par champ renseigné (colonnes réelles de la table companies)
  IF company_record.siret IS NOT NULL THEN quality_score := quality_score + 15; END IF;
  IF company_record.raison_sociale IS NOT NULL THEN quality_score := quality_score + 10; END IF;
  IF company_record.adresse IS NOT NULL THEN quality_score := quality_score + 10; END IF;
  IF company_record.code_naf IS NOT NULL THEN quality_score := quality_score + 5; END IF;
  IF company_record.date_creation IS NOT NULL THEN quality_score := quality_score + 5; END IF;
  IF company_record.verified IS TRUE THEN quality_score := quality_score + 20; END IF;
  IF company_record.rge_certified IS TRUE THEN quality_score := quality_score + 15; END IF;
  -- Les colonnes insurance_decennale et insurance_rc_pro n'existent pas dans la table actuelle
  -- On utilise les labels_rge comme indicateur de qualité
  IF company_record.labels_rge IS NOT NULL AND array_length(company_record.labels_rge, 1) > 0 THEN
    quality_score := quality_score + 10;
  END IF;
  IF company_record.telephone IS NOT NULL THEN quality_score := quality_score + 5; END IF;
  IF company_record.email IS NOT NULL THEN quality_score := quality_score + 5; END IF;

  RETURN LEAST(quality_score, 100);
END;
$$;

-- 4.24 Fonctions cache
CREATE OR REPLACE FUNCTION public.get_cached_company_data(p_siret TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cached_data JSONB;
BEGIN
  SELECT data INTO cached_data
  FROM public.company_cache
  WHERE siret = p_siret
  AND updated_at > (NOW() - INTERVAL '30 days');

  RETURN cached_data;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_company_cache(
  p_siret TEXT,
  p_data JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_cache (siret, data, updated_at)
  VALUES (p_siret, p_data, NOW())
  ON CONFLICT (siret) DO UPDATE SET
    data = EXCLUDED.data,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_company_cache_fetch_count(p_siret TEXT)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.company_cache
  SET fetch_count = COALESCE(fetch_count, 0) + 1
  WHERE siret = p_siret;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_entreprise_cached(p_siret TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cached_data JSONB;
BEGIN
  SELECT data INTO cached_data
  FROM public.entreprises_cache
  WHERE siret = p_siret
  AND updated_at > (NOW() - INTERVAL '30 days');

  RETURN cached_data;
END;
$$;

-- 4.25 Fonction DPE géolocalisé (utilise PostGIS)
CREATE OR REPLACE FUNCTION public.dpe_near_location(
  lat DECIMAL,
  lng DECIMAL,
  radius_km DECIMAL DEFAULT 5
)
RETURNS TABLE(
  id UUID,
  address TEXT,
  dpe_class TEXT,
  ges_class TEXT,
  distance_km DECIMAL
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.address,
    d.dpe_class,
    d.ges_class,
    (ST_Distance(
      ST_SetSRID(ST_MakePoint(d.longitude, d.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) / 1000)::DECIMAL AS distance_km
  FROM public.dpe_records d
  WHERE d.latitude IS NOT NULL
  AND d.longitude IS NOT NULL
  AND ST_DWithin(
    ST_SetSRID(ST_MakePoint(d.longitude, d.latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_km * 1000
  )
  ORDER BY distance_km
  LIMIT 50;
END;
$$;


-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================

COMMENT ON SCHEMA public IS 'TORP Schema - Security fixes applied 2025-12-12';
