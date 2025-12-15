-- Migration: extend_companies_table.sql
-- Ajoute les colonnes BTP manquantes à la table companies existante

-- Ajouter les nouvelles colonnes si elles n'existent pas
DO $$
BEGIN
  -- Colonnes géographiques
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'departement') THEN
    ALTER TABLE public.companies ADD COLUMN departement VARCHAR(3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'region') THEN
    ALTER TABLE public.companies ADD COLUMN region VARCHAR(50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'code_postal') THEN
    ALTER TABLE public.companies ADD COLUMN code_postal VARCHAR(10);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'ville') THEN
    ALTER TABLE public.companies ADD COLUMN ville VARCHAR(100);
  END IF;

  -- Identité légale
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'siren') THEN
    ALTER TABLE public.companies ADD COLUMN siren VARCHAR(9);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'denomination') THEN
    ALTER TABLE public.companies ADD COLUMN denomination VARCHAR(255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'forme_juridique') THEN
    ALTER TABLE public.companies ADD COLUMN forme_juridique VARCHAR(100);
  END IF;

  -- Contact
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'telephone') THEN
    ALTER TABLE public.companies ADD COLUMN telephone VARCHAR(20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'email') THEN
    ALTER TABLE public.companies ADD COLUMN email VARCHAR(255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'site_web') THEN
    ALTER TABLE public.companies ADD COLUMN site_web VARCHAR(255);
  END IF;

  -- Activité
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'code_naf') THEN
    ALTER TABLE public.companies ADD COLUMN code_naf VARCHAR(10);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'activite_principale') THEN
    ALTER TABLE public.companies ADD COLUMN activite_principale TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'specialites') THEN
    ALTER TABLE public.companies ADD COLUMN specialites TEXT[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'zones_intervention') THEN
    ALTER TABLE public.companies ADD COLUMN zones_intervention TEXT[] DEFAULT '{}';
  END IF;

  -- Données financières
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'capital_social') THEN
    ALTER TABLE public.companies ADD COLUMN capital_social DECIMAL(15,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'chiffre_affaires') THEN
    ALTER TABLE public.companies ADD COLUMN chiffre_affaires DECIMAL(15,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'ca_annee') THEN
    ALTER TABLE public.companies ADD COLUMN ca_annee INT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'effectif') THEN
    ALTER TABLE public.companies ADD COLUMN effectif INT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'effectif_tranche') THEN
    ALTER TABLE public.companies ADD COLUMN effectif_tranche VARCHAR(20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'date_creation') THEN
    ALTER TABLE public.companies ADD COLUMN date_creation DATE;
  END IF;

  -- Qualifications et certifications (JSONB)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'qualifications') THEN
    ALTER TABLE public.companies ADD COLUMN qualifications JSONB DEFAULT '[]';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'certifications_jsonb') THEN
    ALTER TABLE public.companies ADD COLUMN certifications_jsonb JSONB DEFAULT '[]';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'labels') THEN
    ALTER TABLE public.companies ADD COLUMN labels JSONB DEFAULT '[]';
  END IF;

  -- Assurances
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'assurance_decennale') THEN
    ALTER TABLE public.companies ADD COLUMN assurance_decennale JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'assurance_rc_pro') THEN
    ALTER TABLE public.companies ADD COLUMN assurance_rc_pro JSONB;
  END IF;

  -- Avis et réputation
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'avis_google') THEN
    ALTER TABLE public.companies ADD COLUMN avis_google JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'avis_autres') THEN
    ALTER TABLE public.companies ADD COLUMN avis_autres JSONB DEFAULT '[]';
  END IF;

  -- Historique TORP
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'historique_torp') THEN
    ALTER TABLE public.companies ADD COLUMN historique_torp JSONB DEFAULT '{}';
  END IF;

  -- Score TORP
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'score_torp') THEN
    ALTER TABLE public.companies ADD COLUMN score_torp FLOAT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'score_details') THEN
    ALTER TABLE public.companies ADD COLUMN score_details JSONB;
  END IF;

  -- Métadonnées
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'source') THEN
    ALTER TABLE public.companies ADD COLUMN source VARCHAR(50) DEFAULT 'manual';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'verified') THEN
    ALTER TABLE public.companies ADD COLUMN verified BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'last_verified_at') THEN
    ALTER TABLE public.companies ADD COLUMN last_verified_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'last_enriched_at') THEN
    ALTER TABLE public.companies ADD COLUMN last_enriched_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'adresse_siege') THEN
    ALTER TABLE public.companies ADD COLUMN adresse_siege TEXT;
  END IF;
END $$;

-- Index pour recherche performante (avec vérification d'existence)
CREATE INDEX IF NOT EXISTS idx_companies_code_postal ON public.companies(code_postal);
CREATE INDEX IF NOT EXISTS idx_companies_departement ON public.companies(departement);
CREATE INDEX IF NOT EXISTS idx_companies_score ON public.companies(score_torp DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_companies_specialites ON public.companies USING GIN(specialites);
CREATE INDEX IF NOT EXISTS idx_companies_qualifications ON public.companies USING GIN(qualifications);

-- Index fulltext sur la dénomination
DROP INDEX IF EXISTS idx_companies_name_search;
CREATE INDEX idx_companies_name_search ON public.companies USING GIN(to_tsvector('french', COALESCE(denomination, '')));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_companies_updated_at ON public.companies;
CREATE TRIGGER trigger_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION update_companies_updated_at();

-- RLS (Row Level Security) - activer si pas déjà fait
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Companies are viewable by authenticated users" ON public.companies;
DROP POLICY IF EXISTS "Companies can be inserted by authenticated users" ON public.companies;
DROP POLICY IF EXISTS "Companies can be updated by authenticated users" ON public.companies;

-- Politiques RLS
CREATE POLICY "Companies are viewable by authenticated users"
  ON public.companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Companies can be inserted by authenticated users"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Companies can be updated by authenticated users"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (true);

-- Fonction de recherche fulltext
CREATE OR REPLACE FUNCTION search_companies(
  search_query TEXT,
  p_departement VARCHAR DEFAULT NULL,
  p_specialites TEXT[] DEFAULT NULL,
  p_min_score FLOAT DEFAULT NULL,
  p_rge_required BOOLEAN DEFAULT FALSE,
  p_limit INT DEFAULT 20
)
RETURNS SETOF public.companies AS $$
BEGIN
  RETURN QUERY
  SELECT c.*
  FROM public.companies c
  WHERE
    -- Recherche fulltext sur dénomination
    (search_query IS NULL OR search_query = '' OR
     to_tsvector('french', COALESCE(c.denomination, '')) @@ plainto_tsquery('french', search_query))
    -- Filtre département
    AND (p_departement IS NULL OR c.departement = p_departement)
    -- Filtre spécialités
    AND (p_specialites IS NULL OR c.specialites && p_specialites)
    -- Filtre score minimum
    AND (p_min_score IS NULL OR c.score_torp >= p_min_score)
    -- Filtre RGE
    AND (NOT p_rge_required OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(c.certifications_jsonb) cert
      WHERE cert->>'type' = 'RGE'
    ))
  ORDER BY c.score_torp DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Commentaires
COMMENT ON TABLE public.companies IS 'Entreprises BTP indexées pour recherche et matching';
COMMENT ON COLUMN public.companies.score_torp IS 'Score de fiabilité TORP (0-100)';
COMMENT ON COLUMN public.companies.qualifications IS 'Qualifications Qualibat et autres au format JSON';
COMMENT ON COLUMN public.companies.certifications_jsonb IS 'Certifications RGE et autres au format JSON détaillé';
