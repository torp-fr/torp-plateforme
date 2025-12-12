-- =====================================================
-- TORP Security Fixes - PHASE 4B: FONCTIONS ANALYTICS & TORP
-- Description: Fonctions analytics et scoring TORP
-- Exécuter après Phase 4A
-- =====================================================

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

-- =====================================================
-- FIN PHASE 4B
-- =====================================================
