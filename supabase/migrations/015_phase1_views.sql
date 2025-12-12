-- =====================================================
-- TORP Security Fixes - PHASE 1: VUES
-- Description: Supprimer SECURITY DEFINER des vues
-- Exécuter en premier
-- =====================================================

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

-- 1.4 ticket_stats
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

-- 1.6 v_prediction_accuracy
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
-- Note: Utilise knowledge_documents et knowledge_chunks (pas knowledge_base)
DROP VIEW IF EXISTS public.rag_health_dashboard CASCADE;
CREATE VIEW public.rag_health_dashboard AS
SELECT
  kd.doc_type as source_type,
  COUNT(DISTINCT kd.id) as document_count,
  SUM(kd.chunks_count) as total_chunks,
  CASE
    WHEN COUNT(kc.id) = 0 THEN 0
    ELSE AVG(CASE WHEN kc.embedding IS NOT NULL THEN 1 ELSE 0 END)
  END as embedding_coverage
FROM public.knowledge_documents kd
LEFT JOIN public.knowledge_chunks kc ON kc.document_id = kd.id
GROUP BY kd.doc_type;

COMMENT ON VIEW public.rag_health_dashboard IS 'Dashboard santé du système RAG';

-- 1.8 v_prix_moyens_region
-- Note: La table est market_data (pas market_prices)
-- Colonnes: region (pas region_code), subcategory (pas sub_category)
-- price_low/price_high/price_avg (pas price_min/price_max/price_mean)
DROP VIEW IF EXISTS public.v_prix_moyens_region CASCADE;
CREATE VIEW public.v_prix_moyens_region AS
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

COMMENT ON VIEW public.v_prix_moyens_region IS 'Prix moyens par région et catégorie';

-- =====================================================
-- FIN PHASE 1
-- =====================================================
