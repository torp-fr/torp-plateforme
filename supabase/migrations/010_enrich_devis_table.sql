-- Migration: Enrichissement table devis
-- Description: Ajoute les colonnes pour localisation, distance et coefficient de prix
-- Author: Claude Code
-- Date: 2025-12-03
-- Version: 1.1 - Fix référence colonne amount

-- =============================================================================
-- SECTION 1: COLONNES LOCALISATION CHANTIER (Géocodage IGN)
-- =============================================================================

ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS adresse_chantier TEXT;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS chantier_latitude DECIMAL(10, 7);
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS chantier_longitude DECIMAL(10, 7);
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS chantier_code_postal TEXT;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS chantier_commune TEXT;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS chantier_departement_code TEXT;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS chantier_departement_nom TEXT;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS chantier_region_code TEXT;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS chantier_region_nom TEXT;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS chantier_geo_score DECIMAL(5, 2);

-- =============================================================================
-- SECTION 2: COLONNES DISTANCE ENTREPRISE <-> CHANTIER
-- =============================================================================

ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS distance_km DECIMAL(8, 2);
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS duree_trajet_minutes INTEGER;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS zone_proximite TEXT CHECK (zone_proximite IN (
  'proximite_immediate',  -- < 15 km
  'zone_locale',          -- 15-30 km
  'zone_departementale',  -- 30-75 km
  'zone_regionale',       -- 75-150 km
  'zone_nationale'        -- > 150 km
));

-- =============================================================================
-- SECTION 3: COLONNES COEFFICIENT DE PRIX REGIONAL
-- =============================================================================

ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS coefficient_regional DECIMAL(4, 2) DEFAULT 1.00;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS coefficient_source TEXT;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS prix_ajuste DECIMAL(15, 2);

-- =============================================================================
-- SECTION 4: COLONNES SCORING ENRICHI (Axes additionnels 1200 pts)
-- =============================================================================

-- Extension du scoring de 1000 à 1200 points
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS score_reputation JSONB;    -- Nouvel axe (100 pts)
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS score_localisation JSONB;  -- Nouvel axe (100 pts)

-- Scoring détaillé amélioré
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS scoring_v2 JSONB;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS scoring_breakdown JSONB;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS scoring_version TEXT DEFAULT 'v1';

-- =============================================================================
-- SECTION 5: COLONNES TRACKING ENRICHISSEMENT
-- =============================================================================

ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS geo_enriched_at TIMESTAMPTZ;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS company_enriched_at TIMESTAMPTZ;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS enrichment_sources TEXT[];
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS enrichment_quality_score INTEGER;

-- =============================================================================
-- INDEXES POUR PERFORMANCE
-- =============================================================================

-- Index sur coordonnées du chantier
CREATE INDEX IF NOT EXISTS idx_devis_chantier_geo ON public.devis(chantier_latitude, chantier_longitude);

-- Index sur code postal et commune
CREATE INDEX IF NOT EXISTS idx_devis_chantier_cp ON public.devis(chantier_code_postal);
CREATE INDEX IF NOT EXISTS idx_devis_chantier_commune ON public.devis(chantier_commune);

-- Index sur département et région
CREATE INDEX IF NOT EXISTS idx_devis_chantier_dept ON public.devis(chantier_departement_code);
CREATE INDEX IF NOT EXISTS idx_devis_chantier_region ON public.devis(chantier_region_code);

-- Index sur distance pour analyses
CREATE INDEX IF NOT EXISTS idx_devis_distance ON public.devis(distance_km);

-- Index sur zone de proximité
CREATE INDEX IF NOT EXISTS idx_devis_zone_proximite ON public.devis(zone_proximite);

-- Index sur coefficient régional
CREATE INDEX IF NOT EXISTS idx_devis_coef_regional ON public.devis(coefficient_regional);

-- Index sur version de scoring
CREATE INDEX IF NOT EXISTS idx_devis_scoring_version ON public.devis(scoring_version);

-- =============================================================================
-- FONCTION: Détermination automatique de la zone de proximité
-- =============================================================================

CREATE OR REPLACE FUNCTION determine_zone_proximite(distance_km DECIMAL)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN distance_km IS NULL THEN NULL
    WHEN distance_km < 15 THEN 'proximite_immediate'
    WHEN distance_km < 30 THEN 'zone_locale'
    WHEN distance_km < 75 THEN 'zone_departementale'
    WHEN distance_km < 150 THEN 'zone_regionale'
    ELSE 'zone_nationale'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- FONCTION: Calcul du coefficient régional BTP
-- =============================================================================

CREATE OR REPLACE FUNCTION get_coefficient_regional_btp(region_code TEXT)
RETURNS DECIMAL AS $$
BEGIN
  -- Coefficients basés sur les indices FFB
  RETURN CASE region_code
    WHEN '11' THEN 1.15  -- Île-de-France
    WHEN '93' THEN 1.10  -- Provence-Alpes-Côte d'Azur
    WHEN '84' THEN 1.05  -- Auvergne-Rhône-Alpes
    WHEN '44' THEN 1.03  -- Grand Est
    WHEN '32' THEN 1.02  -- Hauts-de-France
    WHEN '28' THEN 1.00  -- Normandie
    WHEN '52' THEN 1.00  -- Pays de la Loire
    WHEN '53' THEN 0.98  -- Bretagne
    WHEN '75' THEN 1.02  -- Nouvelle-Aquitaine
    WHEN '76' THEN 0.97  -- Occitanie
    WHEN '27' THEN 1.00  -- Bourgogne-Franche-Comté
    WHEN '24' THEN 0.98  -- Centre-Val de Loire
    WHEN '94' THEN 1.05  -- Corse
    -- DOM-TOM
    WHEN '01' THEN 1.30  -- Guadeloupe
    WHEN '02' THEN 1.30  -- Martinique
    WHEN '03' THEN 1.35  -- Guyane
    WHEN '04' THEN 1.30  -- La Réunion
    WHEN '06' THEN 1.35  -- Mayotte
    ELSE 1.00
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- TRIGGER: Mise à jour automatique de la zone de proximité
-- =============================================================================

CREATE OR REPLACE FUNCTION update_devis_zone_proximite()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.distance_km IS NOT NULL THEN
    NEW.zone_proximite := determine_zone_proximite(NEW.distance_km);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_devis_zone ON public.devis;
CREATE TRIGGER trigger_update_devis_zone
  BEFORE INSERT OR UPDATE OF distance_km ON public.devis
  FOR EACH ROW
  EXECUTE FUNCTION update_devis_zone_proximite();

-- =============================================================================
-- TRIGGER: Mise à jour automatique du coefficient régional
-- Note: Le calcul du prix_ajuste est géré par l'application car le nom
-- de la colonne montant peut varier (amount, montant, total_ht, etc.)
-- =============================================================================

CREATE OR REPLACE FUNCTION update_devis_coefficient_regional()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.chantier_region_code IS NOT NULL AND NEW.coefficient_regional IS NULL THEN
    NEW.coefficient_regional := get_coefficient_regional_btp(NEW.chantier_region_code);
    NEW.coefficient_source := 'FFB';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_devis_coefficient ON public.devis;
CREATE TRIGGER trigger_update_devis_coefficient
  BEFORE INSERT OR UPDATE OF chantier_region_code ON public.devis
  FOR EACH ROW
  EXECUTE FUNCTION update_devis_coefficient_regional();

-- =============================================================================
-- FONCTION: Calcul du score de localisation (100 points)
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_score_localisation(devis_id UUID)
RETURNS JSONB AS $$
DECLARE
  d RECORD;
  score_distance INTEGER := 0;
  score_zone INTEGER := 0;
  score_geo_precision INTEGER := 0;
  total_score INTEGER := 0;
  details JSONB;
BEGIN
  SELECT * INTO d FROM public.devis WHERE id = devis_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Score distance (40 points max)
  score_distance := CASE
    WHEN d.distance_km IS NULL THEN 20  -- Pas de données = score neutre
    WHEN d.distance_km < 15 THEN 40     -- Proximité immédiate
    WHEN d.distance_km < 30 THEN 35     -- Zone locale
    WHEN d.distance_km < 75 THEN 25     -- Départemental
    WHEN d.distance_km < 150 THEN 15    -- Régional
    ELSE 5                               -- National (frais déplacement élevés)
  END;

  -- Score zone (30 points max)
  score_zone := CASE d.zone_proximite
    WHEN 'proximite_immediate' THEN 30
    WHEN 'zone_locale' THEN 25
    WHEN 'zone_departementale' THEN 20
    WHEN 'zone_regionale' THEN 10
    WHEN 'zone_nationale' THEN 5
    ELSE 15  -- Pas de données
  END;

  -- Score précision géocodage (30 points max)
  IF d.chantier_latitude IS NOT NULL AND d.chantier_longitude IS NOT NULL THEN
    score_geo_precision := 30;
  ELSIF d.chantier_code_postal IS NOT NULL THEN
    score_geo_precision := 20;
  ELSIF d.adresse_chantier IS NOT NULL THEN
    score_geo_precision := 10;
  ELSE
    score_geo_precision := 0;
  END IF;

  total_score := score_distance + score_zone + score_geo_precision;

  details := jsonb_build_object(
    'total', total_score,
    'max', 100,
    'distance', jsonb_build_object('score', score_distance, 'max', 40, 'value_km', d.distance_km),
    'zone', jsonb_build_object('score', score_zone, 'max', 30, 'value', d.zone_proximite),
    'precision_geo', jsonb_build_object('score', score_geo_precision, 'max', 30)
  );

  RETURN details;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTAIRES
-- =============================================================================

COMMENT ON COLUMN public.devis.adresse_chantier IS 'Adresse complète du chantier (extraite du devis)';
COMMENT ON COLUMN public.devis.chantier_latitude IS 'Latitude GPS du chantier (géocodage IGN)';
COMMENT ON COLUMN public.devis.chantier_longitude IS 'Longitude GPS du chantier (géocodage IGN)';
COMMENT ON COLUMN public.devis.distance_km IS 'Distance en km entre l''entreprise et le chantier';
COMMENT ON COLUMN public.devis.duree_trajet_minutes IS 'Durée estimée du trajet (minutes)';
COMMENT ON COLUMN public.devis.zone_proximite IS 'Zone de proximité catégorisée';
COMMENT ON COLUMN public.devis.coefficient_regional IS 'Coefficient de prix BTP régional (base FFB)';
COMMENT ON COLUMN public.devis.prix_ajuste IS 'Montant normalisé par le coefficient régional';
COMMENT ON COLUMN public.devis.score_reputation IS 'Score réputation entreprise (0-100) - Axe 7';
COMMENT ON COLUMN public.devis.score_localisation IS 'Score localisation/distance (0-100) - Axe 8';
COMMENT ON COLUMN public.devis.scoring_v2 IS 'Structure scoring complète v2 (1200 points)';
COMMENT ON COLUMN public.devis.scoring_version IS 'Version du moteur de scoring utilisé (v1=1000pts, v2=1200pts)';

COMMENT ON FUNCTION determine_zone_proximite(DECIMAL) IS 'Détermine la zone de proximité selon la distance en km';
COMMENT ON FUNCTION get_coefficient_regional_btp(TEXT) IS 'Retourne le coefficient de prix BTP selon la région (codes INSEE)';
COMMENT ON FUNCTION calculate_score_localisation(UUID) IS 'Calcule le score de localisation (axe 8) pour un devis';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
