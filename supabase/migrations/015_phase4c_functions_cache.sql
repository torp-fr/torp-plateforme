-- =====================================================
-- TORP Security Fixes - PHASE 4C: FONCTIONS CACHE
-- Description: Fonctions de gestion du cache entreprises
-- Exécuter après Phase 4B
-- =====================================================

-- 4.18 update_company_cache_updated_at
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

-- 4.19 should_refresh_company_cache
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

-- 4.20 clean_expired_company_cache
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

-- 4.21 clean_expired_entreprises_cache
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

-- 4.22 get_cached_company_data
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

-- 4.23 upsert_company_cache
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

-- 4.24 increment_company_cache_fetch_count
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

-- 4.25 get_entreprise_cached
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

-- 4.26 calculate_company_data_quality (colonnes corrigées)
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
  IF company_record.labels_rge IS NOT NULL AND array_length(company_record.labels_rge, 1) > 0 THEN
    quality_score := quality_score + 10;
  END IF;
  IF company_record.telephone IS NOT NULL THEN quality_score := quality_score + 5; END IF;
  IF company_record.email IS NOT NULL THEN quality_score := quality_score + 5; END IF;

  RETURN LEAST(quality_score, 100);
END;
$$;

-- =====================================================
-- FIN PHASE 4C
-- =====================================================
