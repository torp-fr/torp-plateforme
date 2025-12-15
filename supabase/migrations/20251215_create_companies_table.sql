-- Migration: create_companies_table.sql
-- Table entreprises BTP pour remplacer les donn??es mock??es

-- Table companies
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identit?? l??gale
  siret VARCHAR(14) UNIQUE NOT NULL,
  siren VARCHAR(9) NOT NULL,
  denomination VARCHAR(255) NOT NULL,
  forme_juridique VARCHAR(100),

  -- Coordonn??es
  adresse_siege TEXT,
  code_postal VARCHAR(10),
  ville VARCHAR(100),
  departement VARCHAR(3),
  region VARCHAR(50),
  telephone VARCHAR(20),
  email VARCHAR(255),
  site_web VARCHAR(255),

  -- Activit??
  code_naf VARCHAR(10),
  activite_principale TEXT,
  specialites TEXT[] DEFAULT '{}',
  zones_intervention TEXT[] DEFAULT '{}',

  -- Donn??es financi??res
  capital_social DECIMAL(15,2),
  chiffre_affaires DECIMAL(15,2),
  ca_annee INT,
  effectif INT,
  effectif_tranche VARCHAR(20),
  date_creation DATE,

  -- Qualifications (JSONB pour flexibilit??)
  qualifications JSONB DEFAULT '[]',
  -- Format: [{"organisme": "Qualibat", "code": "2111", "libelle": "...", "niveau": "...", "validite_fin": "..."}]

  -- Certifications
  certifications JSONB DEFAULT '[]',
  -- Format: [{"type": "RGE", "nom": "...", "domaine": "...", "validite_fin": "..."}]

  -- Labels
  labels JSONB DEFAULT '[]',

  -- Assurances
  assurance_decennale JSONB,
  -- Format: {"assureur": "...", "numero": "...", "validite_fin": "...", "montant_garanti": ...}

  assurance_rc_pro JSONB,
  -- Format: {"assureur": "...", "numero": "...", "validite_fin": "..."}

  -- Avis et r??putation
  avis_google JSONB,
  -- Format: {"note": 4.5, "nombre_avis": 120, "url": "..."}

  avis_autres JSONB DEFAULT '[]',

  -- Historique TORP
  historique_torp JSONB DEFAULT '{}',
  -- Format: {"projets_realises": 5, "taux_satisfaction": 95, "incidents": 0}

  -- Score TORP
  score_torp FLOAT,
  score_details JSONB,
  -- Format: {"qualifications": 80, "experience": 75, "finances": 70, "reputation": 85, "proximite": 90}

  -- M??tadonn??es
  source VARCHAR(50) DEFAULT 'manual', -- manual, api_gouv, pappers, import
  verified BOOLEAN DEFAULT false,
  last_verified_at TIMESTAMPTZ,
  last_enriched_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche performante
CREATE INDEX IF NOT EXISTS idx_companies_siret ON public.companies(siret);
CREATE INDEX IF NOT EXISTS idx_companies_siren ON public.companies(siren);
CREATE INDEX IF NOT EXISTS idx_companies_code_postal ON public.companies(code_postal);
CREATE INDEX IF NOT EXISTS idx_companies_departement ON public.companies(departement);
CREATE INDEX IF NOT EXISTS idx_companies_score ON public.companies(score_torp DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_companies_specialites ON public.companies USING GIN(specialites);
CREATE INDEX IF NOT EXISTS idx_companies_qualifications ON public.companies USING GIN(qualifications);
CREATE INDEX IF NOT EXISTS idx_companies_certifications ON public.companies USING GIN(certifications);
CREATE INDEX IF NOT EXISTS idx_companies_denomination ON public.companies USING GIN(to_tsvector('french', denomination));

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

-- RLS (Row Level Security)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Politiques: les utilisateurs authentifi??s peuvent lire toutes les entreprises
CREATE POLICY "Companies are viewable by authenticated users"
  ON public.companies FOR SELECT
  TO authenticated
  USING (true);

-- Les utilisateurs authentifi??s peuvent ins??rer (pour enrichissement)
CREATE POLICY "Companies can be inserted by authenticated users"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Les utilisateurs authentifi??s peuvent mettre ?? jour (pour enrichissement)
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
    -- Recherche fulltext sur d??nomination
    (search_query IS NULL OR search_query = '' OR
     to_tsvector('french', c.denomination) @@ plainto_tsquery('french', search_query))
    -- Filtre d??partement
    AND (p_departement IS NULL OR c.departement = p_departement)
    -- Filtre sp??cialit??s
    AND (p_specialites IS NULL OR c.specialites && p_specialites)
    -- Filtre score minimum
    AND (p_min_score IS NULL OR c.score_torp >= p_min_score)
    -- Filtre RGE
    AND (NOT p_rge_required OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(c.certifications) cert
      WHERE cert->>'type' = 'RGE'
    ))
  ORDER BY c.score_torp DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Commentaires
COMMENT ON TABLE public.companies IS 'Entreprises BTP index??es pour recherche et matching';
COMMENT ON COLUMN public.companies.score_torp IS 'Score de fiabilit?? TORP (0-100)';
COMMENT ON COLUMN public.companies.qualifications IS 'Qualifications Qualibat et autres au format JSON';
COMMENT ON COLUMN public.companies.certifications IS 'Certifications RGE et autres au format JSON';
