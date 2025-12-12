-- =====================================================
-- TORP Security Fixes - PHASE 4F: FONCTIONS ADMIN & STATS
-- Description: Fonctions d'administration et statistiques
-- Exécuter après Phase 4E
-- =====================================================

-- DROP FUNCTION ajoutés pour éviter les erreurs de changement de type

-- 4.43 get_all_users
DROP FUNCTION IF EXISTS public.get_all_users() CASCADE;
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

-- 4.44 get_all_feedbacks
DROP FUNCTION IF EXISTS public.get_all_feedbacks() CASCADE;
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

-- 4.45 get_all_analyses
DROP FUNCTION IF EXISTS public.get_all_analyses() CASCADE;
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

-- 4.46 get_analytics_stats
DROP FUNCTION IF EXISTS public.get_analytics_stats() CASCADE;
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

-- 4.47 get_user_stats
DROP FUNCTION IF EXISTS public.get_user_stats() CASCADE;
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

-- 4.48 get_knowledge_stats
DROP FUNCTION IF EXISTS public.get_knowledge_stats() CASCADE;
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
    jsonb_object_agg(COALESCE(doc_type, 'unknown'), cnt)
  FROM (
    SELECT doc_type, COUNT(*) as cnt
    FROM public.knowledge_documents
    WHERE status = 'indexed'
    GROUP BY doc_type
  ) sub;
END;
$$;

-- 4.49 torp_stats
DROP FUNCTION IF EXISTS public.torp_stats() CASCADE;
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

-- Note: dpe_near_location supprimé car la table dpe_records n'existe pas

-- =====================================================
-- FINALISATION
-- =====================================================

COMMENT ON SCHEMA public IS 'TORP Schema - Security fixes applied 2025-12-12';

-- =====================================================
-- FIN PHASE 4F - MIGRATION TERMINÉE
-- =====================================================
