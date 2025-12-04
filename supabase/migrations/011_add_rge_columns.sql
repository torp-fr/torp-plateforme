-- Migration 011: Add RGE ADEME verification columns
-- Source: API Open Data ADEME (gratuit, pas d'authentification)
-- Documentation: https://data.ademe.fr/datasets/liste-des-entreprises-rge-2

-- ============================================
-- COLONNES RGE POUR LA TABLE COMPANIES
-- ============================================

-- Statut RGE global
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rge_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rge_certified BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rge_score INTEGER DEFAULT 0;

-- Nombre de qualifications
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rge_qualifications_count INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rge_qualifications_actives_count INTEGER DEFAULT 0;

-- Domaines couverts (arrays)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rge_domaines TEXT[] DEFAULT '{}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rge_meta_domaines TEXT[] DEFAULT '{}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rge_organismes TEXT[] DEFAULT '{}';

-- Detail des qualifications (JSONB pour flexibilite)
-- Structure: [{code, nom, domaines[], organisme, dateDebut, dateFin, joursRestants, urlCertificat}]
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rge_qualifications JSONB DEFAULT '[]';

-- Qualifications actives uniquement
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rge_qualifications_actives JSONB DEFAULT '[]';

-- Alertes (expiration proche, etc.)
-- Structure: [{type, message, qualification?, joursRestants?}]
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rge_alertes JSONB DEFAULT '[]';

-- Prochaine expiration
-- Structure: {qualification, dateFin, joursRestants}
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rge_prochaine_expiration JSONB DEFAULT NULL;

-- Certificats avec URLs
-- Structure: [{qualification, organisme, url}]
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rge_certificats JSONB DEFAULT '[]';

-- Travaille avec particuliers
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rge_travaille_particuliers BOOLEAN DEFAULT NULL;

-- Source des donnees
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rge_source TEXT DEFAULT NULL;

-- Timestamp de mise a jour
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rge_last_update TIMESTAMPTZ;

-- ============================================
-- INDEX POUR PERFORMANCES
-- ============================================

-- Index sur le statut RGE (recherche entreprises certifiees)
CREATE INDEX IF NOT EXISTS idx_companies_rge_certified
ON companies(rge_certified)
WHERE rge_certified = TRUE;

-- Index sur le score RGE (tri par score)
CREATE INDEX IF NOT EXISTS idx_companies_rge_score
ON companies(rge_score DESC);

-- Index GIN sur les domaines (recherche par domaine)
CREATE INDEX IF NOT EXISTS idx_companies_rge_domaines
ON companies USING GIN(rge_domaines);

-- Index GIN sur les meta-domaines
CREATE INDEX IF NOT EXISTS idx_companies_rge_meta_domaines
ON companies USING GIN(rge_meta_domaines);

-- Index GIN sur les organismes certificateurs
CREATE INDEX IF NOT EXISTS idx_companies_rge_organismes
ON companies USING GIN(rge_organismes);

-- Index sur la date de mise a jour (pour cache)
CREATE INDEX IF NOT EXISTS idx_companies_rge_last_update
ON companies(rge_last_update DESC NULLS LAST);

-- ============================================
-- COMMENTAIRES DOCUMENTATION
-- ============================================

COMMENT ON COLUMN companies.rge_verified IS 'True si verification RGE effectuee via API ADEME';
COMMENT ON COLUMN companies.rge_certified IS 'True si entreprise a au moins une qualification RGE active';
COMMENT ON COLUMN companies.rge_score IS 'Score RGE 0-100 calcule selon nb qualifications, diversite, validite';
COMMENT ON COLUMN companies.rge_qualifications_count IS 'Nombre total de qualifications (actives + expirees)';
COMMENT ON COLUMN companies.rge_qualifications_actives_count IS 'Nombre de qualifications actuellement valides';
COMMENT ON COLUMN companies.rge_domaines IS 'Liste des domaines de travaux couverts par les qualifications';
COMMENT ON COLUMN companies.rge_meta_domaines IS 'Efficacite energetique, Energies renouvelables, Etudes, Renovation globale';
COMMENT ON COLUMN companies.rge_organismes IS 'Organismes: qualibat, qualifelec, qualitenr, opqibi, cnoa, cerqual, certibat, afnor, lne';
COMMENT ON COLUMN companies.rge_qualifications IS 'Detail complet de toutes les qualifications (JSON)';
COMMENT ON COLUMN companies.rge_qualifications_actives IS 'Qualifications actuellement valides uniquement (JSON)';
COMMENT ON COLUMN companies.rge_alertes IS 'Alertes: expiration proche, domaines manquants, etc.';
COMMENT ON COLUMN companies.rge_prochaine_expiration IS 'Qualification qui expire le plus tot';
COMMENT ON COLUMN companies.rge_certificats IS 'URLs des certificats PDF';
COMMENT ON COLUMN companies.rge_travaille_particuliers IS 'True si entreprise travaille avec particuliers';
COMMENT ON COLUMN companies.rge_source IS 'Source API: ademe_rge_liste ou ademe_rge_historique';
COMMENT ON COLUMN companies.rge_last_update IS 'Date derniere verification API ADEME';

-- ============================================
-- FONCTION DE MISE A JOUR
-- ============================================

-- Fonction pour mettre a jour le statut RGE
CREATE OR REPLACE FUNCTION update_rge_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculer le statut certified basé sur les qualifications actives
  NEW.rge_certified := COALESCE(NEW.rge_qualifications_actives_count, 0) > 0;

  -- Mettre a jour le timestamp
  NEW.rge_last_update := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mise a jour automatique
DROP TRIGGER IF EXISTS trg_update_rge_status ON companies;
CREATE TRIGGER trg_update_rge_status
BEFORE INSERT OR UPDATE OF rge_qualifications_actives_count, rge_qualifications_actives
ON companies
FOR EACH ROW
EXECUTE FUNCTION update_rge_status();

-- ============================================
-- VUE POUR ENTREPRISES RGE
-- ============================================

CREATE OR REPLACE VIEW v_companies_rge AS
SELECT
  c.id,
  c.siret,
  COALESCE(c.denomination_usuelle, c.raison_sociale) AS nom_entreprise,
  c.adresse_complete,
  c.code_postal,
  c.commune,
  c.rge_certified,
  c.rge_score,
  c.rge_qualifications_actives_count,
  c.rge_domaines,
  c.rge_meta_domaines,
  c.rge_organismes,
  c.rge_prochaine_expiration,
  c.rge_alertes,
  c.rge_last_update
FROM companies c
WHERE c.rge_verified = TRUE;

COMMENT ON VIEW v_companies_rge IS 'Vue des entreprises avec verification RGE effectuee';
