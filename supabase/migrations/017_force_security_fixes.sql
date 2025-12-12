-- =====================================================
-- TORP Security Fixes - FORCE FIX
-- Description: Forcer les corrections de sécurité
-- =====================================================

-- =====================================================
-- SECTION 1: VUES AVEC SECURITY INVOKER EXPLICITE
-- =====================================================

-- 1.1 feedback_summary
DROP VIEW IF EXISTS public.feedback_summary CASCADE;
CREATE VIEW public.feedback_summary
WITH (security_invoker = true)
AS
SELECT
  feedback_type,
  status,
  COUNT(*) as count,
  MAX(created_at) as last_feedback
FROM public.user_feedback
GROUP BY feedback_type, status;

-- 1.2 analytics_overview
DROP VIEW IF EXISTS public.analytics_overview CASCADE;
CREATE VIEW public.analytics_overview
WITH (security_invoker = true)
AS
SELECT
  event_type,
  DATE(created_at) as event_date,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users
FROM public.analytics_events
GROUP BY event_type, DATE(created_at);

-- 1.3 v_prix_moyens_region
DROP VIEW IF EXISTS public.v_prix_moyens_region CASCADE;
CREATE VIEW public.v_prix_moyens_region
WITH (security_invoker = true)
AS
SELECT
  region,
  category,
  subcategory,
  AVG(price_low) as avg_price_min,
  AVG(price_high) as avg_price_max,
  AVG(price_avg) as avg_price_mean,
  COUNT(*) as sample_count
FROM public.market_data
GROUP BY region, category, subcategory;

-- 1.4 ticket_stats
DROP VIEW IF EXISTS public.ticket_stats CASCADE;
CREATE VIEW public.ticket_stats
WITH (security_invoker = true)
AS
SELECT
  status,
  grade,
  COUNT(*) as ticket_count,
  AVG(EXTRACT(EPOCH FROM (COALESCE(updated_at, NOW()) - date_generation))/3600)::DECIMAL(10,2) as avg_hours_since_generation
FROM public.torp_tickets
GROUP BY status, grade;

-- 1.5 v_prediction_accuracy
DROP VIEW IF EXISTS public.v_prediction_accuracy CASCADE;
CREATE VIEW public.v_prediction_accuracy
WITH (security_invoker = true)
AS
SELECT
  grade,
  COUNT(*) as total_predictions,
  AVG(torp_score_overall) as avg_score
FROM public.devis_analysis_metrics
WHERE grade IS NOT NULL
GROUP BY grade;

-- 1.6 torp_score_averages
DROP VIEW IF EXISTS public.torp_score_averages CASCADE;
CREATE VIEW public.torp_score_averages
WITH (security_invoker = true)
AS
SELECT
  DATE_TRUNC('month', created_at) as month,
  AVG(torp_score_overall) as avg_score,
  COUNT(*) as analysis_count
FROM public.devis_analysis_metrics
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- 1.7 rag_health_dashboard
DROP VIEW IF EXISTS public.rag_health_dashboard CASCADE;
CREATE VIEW public.rag_health_dashboard
WITH (security_invoker = true)
AS
SELECT
  kd.doc_type as source_type,
  COUNT(DISTINCT kd.id) as document_count,
  SUM(kd.chunks_count) as total_chunks,
  CASE WHEN COUNT(kc.id) = 0 THEN 0
    ELSE AVG(CASE WHEN kc.embedding IS NOT NULL THEN 1 ELSE 0 END)
  END as embedding_coverage
FROM public.knowledge_documents kd
LEFT JOIN public.knowledge_chunks kc ON kc.document_id = kd.id
GROUP BY kd.doc_type;

-- 1.8 v_avis_agregats_entreprise
DROP VIEW IF EXISTS public.v_avis_agregats_entreprise CASCADE;
CREATE VIEW public.v_avis_agregats_entreprise
WITH (security_invoker = true)
AS
SELECT
  c.id as company_id,
  c.raison_sociale as company_name,
  c.siret,
  COUNT(DISTINCT d.id) as total_devis,
  AVG(dam.torp_score_overall) as avg_score,
  COUNT(DISTINCT CASE WHEN dam.grade = 'A' THEN dam.id END) as grade_a_count,
  COUNT(DISTINCT CASE WHEN dam.grade = 'B' THEN dam.id END) as grade_b_count,
  COUNT(DISTINCT CASE WHEN dam.grade = 'C' THEN dam.id END) as grade_c_count,
  COUNT(DISTINCT CASE WHEN dam.grade = 'D' THEN dam.id END) as grade_d_count
FROM public.companies c
LEFT JOIN public.devis d ON d.company_id = c.id
LEFT JOIN public.devis_analysis_metrics dam ON dam.devis_id = d.id
GROUP BY c.id, c.raison_sociale, c.siret;

-- =====================================================
-- SECTION 2: ACTIVER RLS DIRECTEMENT (sans IF EXISTS)
-- =====================================================

-- Tables avec RLS désactivé
ALTER TABLE IF EXISTS public.dpe_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.company_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.geographic_distances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.technical_norms ENABLE ROW LEVEL SECURITY;

-- Policies pour ces tables
DROP POLICY IF EXISTS "dpe_records_select_authenticated" ON public.dpe_records;
CREATE POLICY "dpe_records_select_authenticated" ON public.dpe_records
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "company_verifications_select_authenticated" ON public.company_verifications;
CREATE POLICY "company_verifications_select_authenticated" ON public.company_verifications
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "knowledge_base_select_authenticated" ON public.knowledge_base;
CREATE POLICY "knowledge_base_select_authenticated" ON public.knowledge_base
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "geographic_distances_select_authenticated" ON public.geographic_distances;
CREATE POLICY "geographic_distances_select_authenticated" ON public.geographic_distances
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "market_prices_select_authenticated" ON public.market_prices;
CREATE POLICY "market_prices_select_authenticated" ON public.market_prices
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "technical_norms_select_authenticated" ON public.technical_norms;
CREATE POLICY "technical_norms_select_authenticated" ON public.technical_norms
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- =====================================================
-- SECTION 3: FONCTIONS - DROP TOUTES SIGNATURES PUIS RECREER
-- =====================================================

-- 3.1 rag_full_cleanup
DROP FUNCTION IF EXISTS public.rag_full_cleanup CASCADE;
CREATE FUNCTION public.rag_full_cleanup()
RETURNS TABLE(empty_deleted INTEGER, orphan_deleted INTEGER, short_deleted INTEGER, no_embedding_deleted INTEGER)
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  empty_deleted := public.cleanup_empty_chunks();
  orphan_deleted := public.cleanup_orphan_chunks();
  short_deleted := public.cleanup_short_chunks();
  no_embedding_deleted := public.cleanup_no_embedding_chunks();
  RETURN NEXT;
END;
$$;

-- 3.2 hybrid_search_documents
DROP FUNCTION IF EXISTS public.hybrid_search_documents CASCADE;
CREATE FUNCTION public.hybrid_search_documents(query_text TEXT, query_embedding vector(1536), match_count INT DEFAULT 10, keyword_weight FLOAT DEFAULT 0.3)
RETURNS TABLE(id UUID, content TEXT, doc_type TEXT, combined_score FLOAT)
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT kc.id, kc.content, kd.doc_type,
    ((1 - keyword_weight) * (1 - (kc.embedding <=> query_embedding)) +
     keyword_weight * ts_rank(to_tsvector('french', kc.content), plainto_tsquery('french', query_text))) AS combined_score
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE kc.embedding IS NOT NULL AND kd.status = 'indexed'
  ORDER BY combined_score DESC LIMIT match_count;
END;
$$;

-- 3.3 dpe_near_location
DROP FUNCTION IF EXISTS public.dpe_near_location CASCADE;
CREATE FUNCTION public.dpe_near_location(p_lat FLOAT, p_lon FLOAT, p_radius_meters INT DEFAULT 5000, p_limit INT DEFAULT 50)
RETURNS TABLE(id UUID, dpe_class TEXT, distance_meters FLOAT)
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.dpe_class,
    ST_Distance(ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography, d.location::geography) as distance_meters
  FROM public.dpe_records d
  WHERE ST_DWithin(ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography, d.location::geography, p_radius_meters)
  ORDER BY distance_meters LIMIT p_limit;
END;
$$;

-- 3.4 cleanup_empty_chunks
DROP FUNCTION IF EXISTS public.cleanup_empty_chunks CASCADE;
CREATE FUNCTION public.cleanup_empty_chunks()
RETURNS INTEGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM public.knowledge_chunks WHERE content IS NULL OR TRIM(content) = '';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 3.5 search_knowledge
DROP FUNCTION IF EXISTS public.search_knowledge CASCADE;
CREATE FUNCTION public.search_knowledge(query_text TEXT, filter_type TEXT DEFAULT NULL, max_results INT DEFAULT 20)
RETURNS TABLE(id UUID, content TEXT, source_type TEXT, rank FLOAT)
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT kc.id, kc.content, kd.doc_type as source_type,
    ts_rank(to_tsvector('french', kc.content), plainto_tsquery('french', query_text)) AS rank
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE kd.status = 'indexed'
  AND to_tsvector('french', kc.content) @@ plainto_tsquery('french', query_text)
  AND (filter_type IS NULL OR kd.doc_type = filter_type)
  ORDER BY rank DESC LIMIT max_results;
END;
$$;

-- 3.6 match_documents
DROP FUNCTION IF EXISTS public.match_documents CASCADE;
CREATE FUNCTION public.match_documents(query_embedding vector(1536), match_threshold FLOAT DEFAULT 0.7, match_count INT DEFAULT 10)
RETURNS TABLE(id UUID, content TEXT, metadata JSONB, similarity FLOAT)
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT kc.id, kc.content, kc.metadata, 1 - (kc.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE kc.embedding IS NOT NULL AND kd.status = 'indexed'
  AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding LIMIT match_count;
END;
$$;

-- 3.7 get_analytics_stats
DROP FUNCTION IF EXISTS public.get_analytics_stats CASCADE;
CREATE FUNCTION public.get_analytics_stats()
RETURNS TABLE(total_events BIGINT, unique_users BIGINT, events_today BIGINT, top_event_type TEXT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin only'; END IF;
  RETURN QUERY
  SELECT COUNT(*)::BIGINT, COUNT(DISTINCT user_id)::BIGINT,
    COUNT(*) FILTER (WHERE created_at > CURRENT_DATE)::BIGINT,
    (SELECT event_type FROM public.analytics_events GROUP BY event_type ORDER BY COUNT(*) DESC LIMIT 1)
  FROM public.analytics_events;
END;
$$;

-- 3.8 assign_grade
DROP FUNCTION IF EXISTS public.assign_grade CASCADE;
CREATE FUNCTION public.assign_grade(score DECIMAL)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  IF score >= 80 THEN RETURN 'A';
  ELSIF score >= 60 THEN RETURN 'B';
  ELSIF score >= 40 THEN RETURN 'C';
  ELSE RETURN 'D'; END IF;
END;
$$;

-- 3.9 calculate_torp_score
DROP FUNCTION IF EXISTS public.calculate_torp_score CASCADE;
CREATE FUNCTION public.calculate_torp_score(p_devis_id UUID)
RETURNS DECIMAL LANGUAGE plpgsql SET search_path = public AS $$
DECLARE total_score DECIMAL := 0; metric_record RECORD;
BEGIN
  SELECT * INTO metric_record FROM public.devis_analysis_metrics WHERE devis_id = p_devis_id;
  IF FOUND THEN total_score := COALESCE(metric_record.torp_score_overall, 0); END IF;
  RETURN total_score;
END;
$$;

-- 3.10 cleanup_orphan_chunks
DROP FUNCTION IF EXISTS public.cleanup_orphan_chunks CASCADE;
CREATE FUNCTION public.cleanup_orphan_chunks()
RETURNS INTEGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM public.knowledge_chunks c
  WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_documents d WHERE d.id = c.document_id);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 3.11 cleanup_no_embedding_chunks
DROP FUNCTION IF EXISTS public.cleanup_no_embedding_chunks CASCADE;
CREATE FUNCTION public.cleanup_no_embedding_chunks()
RETURNS INTEGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM public.knowledge_chunks WHERE embedding IS NULL AND created_at < (NOW() - INTERVAL '7 days');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 3.12 should_refresh_company_cache
DROP FUNCTION IF EXISTS public.should_refresh_company_cache CASCADE;
CREATE FUNCTION public.should_refresh_company_cache(cache_updated_at TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  RETURN cache_updated_at IS NULL OR cache_updated_at < (NOW() - INTERVAL '30 days');
END;
$$;

-- 3.13 match_market_prices
DROP FUNCTION IF EXISTS public.match_market_prices CASCADE;
CREATE FUNCTION public.match_market_prices(p_region TEXT DEFAULT NULL, p_category TEXT DEFAULT NULL, p_work_type TEXT DEFAULT NULL)
RETURNS TABLE(id UUID, work_type TEXT, price_low DECIMAL, price_high DECIMAL, price_avg DECIMAL, region TEXT)
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.work_type, m.price_low, m.price_high, m.price_avg, m.region
  FROM public.market_data m
  WHERE (p_region IS NULL OR m.region = p_region)
  AND (p_category IS NULL OR m.category = p_category)
  AND (p_work_type IS NULL OR m.work_type ILIKE '%' || p_work_type || '%')
  ORDER BY m.category, m.work_type LIMIT 50;
END;
$$;

-- 3.14 upsert_company_cache
DROP FUNCTION IF EXISTS public.upsert_company_cache CASCADE;
CREATE FUNCTION public.upsert_company_cache(p_siret TEXT, p_data JSONB)
RETURNS VOID LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.company_cache (siret, data, updated_at) VALUES (p_siret, p_data, NOW())
  ON CONFLICT (siret) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
END;
$$;

-- 3.15 match_knowledge
DROP FUNCTION IF EXISTS public.match_knowledge CASCADE;
CREATE FUNCTION public.match_knowledge(query_embedding vector(1536), match_threshold FLOAT DEFAULT 0.7, match_count INT DEFAULT 5)
RETURNS TABLE(id UUID, content TEXT, source_type TEXT, similarity FLOAT)
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT kc.id, kc.content, kd.doc_type as source_type, 1 - (kc.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE kc.embedding IS NOT NULL AND kd.status = 'indexed'
  AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding LIMIT match_count;
END;
$$;

-- 3.16 get_entreprise_cached
DROP FUNCTION IF EXISTS public.get_entreprise_cached CASCADE;
CREATE FUNCTION public.get_entreprise_cached(p_siret TEXT)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public AS $$
DECLARE cached_data JSONB;
BEGIN
  SELECT data INTO cached_data FROM public.entreprises_cache
  WHERE siret = p_siret AND updated_at > (NOW() - INTERVAL '30 days');
  RETURN cached_data;
END;
$$;

-- 3.17 calculate_grade_from_score
DROP FUNCTION IF EXISTS public.calculate_grade_from_score CASCADE;
CREATE FUNCTION public.calculate_grade_from_score(score DECIMAL)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  IF score >= 80 THEN RETURN 'A';
  ELSIF score >= 60 THEN RETURN 'B';
  ELSIF score >= 40 THEN RETURN 'C';
  ELSE RETURN 'D'; END IF;
END;
$$;

-- 3.18 match_technical_norms
DROP FUNCTION IF EXISTS public.match_technical_norms CASCADE;
CREATE FUNCTION public.match_technical_norms(p_category TEXT DEFAULT NULL, p_keyword TEXT DEFAULT NULL)
RETURNS TABLE(id UUID, norm_code TEXT, title TEXT, category TEXT)
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT tn.id, tn.norm_code, tn.title, tn.category
  FROM public.technical_norms tn
  WHERE (p_category IS NULL OR tn.category = p_category)
  AND (p_keyword IS NULL OR tn.title ILIKE '%' || p_keyword || '%')
  LIMIT 50;
END;
$$;

-- 3.19 process_text_document
DROP FUNCTION IF EXISTS public.process_text_document CASCADE;
CREATE FUNCTION public.process_text_document(doc_content TEXT, chunk_size INT DEFAULT 1000, chunk_overlap INT DEFAULT 200)
RETURNS TABLE(chunk_index INT, chunk_content TEXT)
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE doc_length INT; current_pos INT := 1; chunk_idx INT := 0;
BEGIN
  doc_length := LENGTH(doc_content);
  WHILE current_pos < doc_length LOOP
    chunk_idx := chunk_idx + 1;
    RETURN QUERY SELECT chunk_idx, SUBSTRING(doc_content FROM current_pos FOR chunk_size);
    current_pos := current_pos + chunk_size - chunk_overlap;
  END LOOP;
END;
$$;

-- 3.20 get_user_stats
DROP FUNCTION IF EXISTS public.get_user_stats CASCADE;
CREATE FUNCTION public.get_user_stats()
RETURNS TABLE(total_users BIGINT, b2c_users BIGINT, b2b_users BIGINT, new_today BIGINT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: admin only'; END IF;
  RETURN QUERY
  SELECT COUNT(*)::BIGINT, COUNT(*) FILTER (WHERE user_type = 'B2C')::BIGINT,
    COUNT(*) FILTER (WHERE user_type = 'B2B')::BIGINT,
    COUNT(*) FILTER (WHERE created_at > CURRENT_DATE)::BIGINT
  FROM public.users;
END;
$$;

-- 3.21 cleanup_short_chunks
DROP FUNCTION IF EXISTS public.cleanup_short_chunks CASCADE;
CREATE FUNCTION public.cleanup_short_chunks(min_length INTEGER DEFAULT 50)
RETURNS INTEGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM public.knowledge_chunks WHERE LENGTH(content) < min_length;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 3.22 calculate_score_localisation
DROP FUNCTION IF EXISTS public.calculate_score_localisation CASCADE;
CREATE FUNCTION public.calculate_score_localisation(p_company_id UUID, p_project_id UUID)
RETURNS DECIMAL LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RETURN 50; END;
$$;

-- 3.23 track_event
DROP FUNCTION IF EXISTS public.track_event CASCADE;
CREATE FUNCTION public.track_event(p_event_type TEXT, p_user_id UUID DEFAULT NULL, p_metadata JSONB DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE event_id UUID;
BEGIN
  INSERT INTO public.analytics_events (event_type, user_id, metadata, created_at)
  VALUES (p_event_type, COALESCE(p_user_id, auth.uid()), p_metadata, NOW())
  RETURNING id INTO event_id;
  RETURN event_id;
END;
$$;

-- =====================================================
-- FIN MIGRATION 017
-- =====================================================
