-- Migration: Enrichissement table companies
-- Description: Ajoute les colonnes pour les données Sirene, IGN, Pappers et Google
-- Author: Claude Code
-- Date: 2025-12-03

-- =============================================================================
-- SECTION 1: COLONNES SIRENE (API Recherche Entreprises)
-- =============================================================================

-- SIREN déjà présent via siret, on ajoute les colonnes manquantes
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS siren TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS nic TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS denomination_usuelle TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS code_naf TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS libelle_naf TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tranche_effectifs TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS date_creation_etablissement DATE;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS etat_administratif TEXT CHECK (etat_administratif IN ('A', 'F'));
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS adresse_complete TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS code_postal TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS commune TEXT;

-- =============================================================================
-- SECTION 2: COLONNES GEOCODAGE IGN (API Géoplateforme)
-- =============================================================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS departement_code TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS departement_nom TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS region_code TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS region_nom TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS geo_score DECIMAL(5, 2);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS geo_source TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS geo_updated_at TIMESTAMPTZ;

-- =============================================================================
-- SECTION 3: COLONNES PAPPERS (API Premium)
-- =============================================================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS chiffre_affaires DECIMAL(15, 2);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS chiffre_affaires_annee INTEGER;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS resultat_net DECIMAL(15, 2);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS capital_social DECIMAL(15, 2);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS forme_juridique TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS pappers_score INTEGER;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS labels_rge TEXT[];
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS conventions_collectives JSONB;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS dirigeants JSONB;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS beneficiaires_effectifs JSONB;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS etablissements_count INTEGER;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS procedures_collectives JSONB;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS derniers_comptes JSONB;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS pappers_updated_at TIMESTAMPTZ;

-- =============================================================================
-- SECTION 4: COLONNES GOOGLE PLACES (API à intégrer)
-- =============================================================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS google_place_id TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS google_rating DECIMAL(2, 1);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS google_reviews_count INTEGER;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS google_reviews_sample JSONB;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS google_sentiment_score DECIMAL(3, 2);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS google_photos_url TEXT[];
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS google_updated_at TIMESTAMPTZ;

-- =============================================================================
-- SECTION 5: COLONNES DE TRACKING / QUALITE
-- =============================================================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS data_sources TEXT[];
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS data_quality_score INTEGER DEFAULT 0;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS enrichment_errors JSONB;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS scoring_details JSONB;

-- =============================================================================
-- INDEXES POUR PERFORMANCE
-- =============================================================================

-- Index sur siren pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_companies_siren ON public.companies(siren);

-- Index sur code postal et commune
CREATE INDEX IF NOT EXISTS idx_companies_code_postal ON public.companies(code_postal);
CREATE INDEX IF NOT EXISTS idx_companies_commune ON public.companies(commune);

-- Index sur coordonnées géographiques
CREATE INDEX IF NOT EXISTS idx_companies_geo ON public.companies(latitude, longitude);

-- Index sur département et région
CREATE INDEX IF NOT EXISTS idx_companies_departement ON public.companies(departement_code);
CREATE INDEX IF NOT EXISTS idx_companies_region ON public.companies(region_code);

-- Index sur labels RGE (GIN pour array)
CREATE INDEX IF NOT EXISTS idx_companies_labels_rge ON public.companies USING GIN(labels_rge);

-- Index sur sources de données (GIN pour array)
CREATE INDEX IF NOT EXISTS idx_companies_data_sources ON public.companies USING GIN(data_sources);

-- Index sur score de qualité des données
CREATE INDEX IF NOT EXISTS idx_companies_data_quality ON public.companies(data_quality_score);

-- Index sur Google rating pour recherche des mieux notées
CREATE INDEX IF NOT EXISTS idx_companies_google_rating ON public.companies(google_rating DESC);

-- =============================================================================
-- FONCTION: Mise à jour automatique du siren depuis siret
-- =============================================================================

CREATE OR REPLACE FUNCTION update_company_siren()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.siret IS NOT NULL AND (NEW.siren IS NULL OR NEW.siren = '') THEN
    NEW.siren := LEFT(NEW.siret, 9);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour auto-remplir siren
DROP TRIGGER IF EXISTS trigger_update_company_siren ON public.companies;
CREATE TRIGGER trigger_update_company_siren
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION update_company_siren();

-- Mise à jour des siren existants
UPDATE public.companies
SET siren = LEFT(siret, 9)
WHERE siret IS NOT NULL AND (siren IS NULL OR siren = '');

-- =============================================================================
-- FONCTION: Calcul du score de qualité des données
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_company_data_quality(company_id UUID)
RETURNS INTEGER AS $$
DECLARE
  quality_score INTEGER := 0;
  c RECORD;
BEGIN
  SELECT * INTO c FROM public.companies WHERE id = company_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Base: Informations obligatoires (30 points)
  IF c.siret IS NOT NULL THEN quality_score := quality_score + 10; END IF;
  IF c.name IS NOT NULL THEN quality_score := quality_score + 10; END IF;
  IF c.adresse_complete IS NOT NULL THEN quality_score := quality_score + 10; END IF;

  -- Sirene: Données légales (20 points)
  IF c.code_naf IS NOT NULL THEN quality_score := quality_score + 5; END IF;
  IF c.date_creation_etablissement IS NOT NULL THEN quality_score := quality_score + 5; END IF;
  IF c.tranche_effectifs IS NOT NULL THEN quality_score := quality_score + 5; END IF;
  IF c.etat_administratif = 'A' THEN quality_score := quality_score + 5; END IF;

  -- Géocodage: Localisation précise (15 points)
  IF c.latitude IS NOT NULL AND c.longitude IS NOT NULL THEN quality_score := quality_score + 10; END IF;
  IF c.departement_code IS NOT NULL THEN quality_score := quality_score + 5; END IF;

  -- Pappers: Données financières (20 points)
  IF c.chiffre_affaires IS NOT NULL THEN quality_score := quality_score + 10; END IF;
  IF c.forme_juridique IS NOT NULL THEN quality_score := quality_score + 5; END IF;
  IF c.dirigeants IS NOT NULL AND jsonb_array_length(c.dirigeants) > 0 THEN quality_score := quality_score + 5; END IF;

  -- Google: Réputation (15 points)
  IF c.google_rating IS NOT NULL THEN quality_score := quality_score + 10; END IF;
  IF c.google_reviews_count > 0 THEN quality_score := quality_score + 5; END IF;

  RETURN LEAST(quality_score, 100);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTAIRES
-- =============================================================================

COMMENT ON COLUMN public.companies.siren IS 'Numéro SIREN (9 chiffres) - auto-extrait du SIRET';
COMMENT ON COLUMN public.companies.nic IS 'Numéro Interne de Classement (5 derniers chiffres du SIRET)';
COMMENT ON COLUMN public.companies.code_naf IS 'Code NAF/APE de l''activité principale';
COMMENT ON COLUMN public.companies.libelle_naf IS 'Libellé en clair de l''activité NAF';
COMMENT ON COLUMN public.companies.tranche_effectifs IS 'Tranche d''effectifs salariés (code INSEE)';
COMMENT ON COLUMN public.companies.etat_administratif IS 'État: A=Actif, F=Fermé';
COMMENT ON COLUMN public.companies.latitude IS 'Latitude GPS (géocodage IGN)';
COMMENT ON COLUMN public.companies.longitude IS 'Longitude GPS (géocodage IGN)';
COMMENT ON COLUMN public.companies.geo_score IS 'Score de confiance du géocodage (0-100)';
COMMENT ON COLUMN public.companies.chiffre_affaires IS 'Dernier CA connu (source Pappers)';
COMMENT ON COLUMN public.companies.labels_rge IS 'Labels RGE actifs (tableau)';
COMMENT ON COLUMN public.companies.google_rating IS 'Note Google (1-5)';
COMMENT ON COLUMN public.companies.google_reviews_count IS 'Nombre d''avis Google';
COMMENT ON COLUMN public.companies.data_sources IS 'Sources de données utilisées (sirene, pappers, ign, google)';
COMMENT ON COLUMN public.companies.data_quality_score IS 'Score de qualité des données (0-100)';
COMMENT ON COLUMN public.companies.scoring_details IS 'Détail du calcul du score TORP par axe';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
