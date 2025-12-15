-- =====================================================
-- Migration 027: Phase 1 - Consultation & Sélection Entreprises
-- VERSION CLEAN SLATE: Drop et recréation complète
-- Tables pour le DCE, les entreprises, les offres, les contrats et les formalités
-- =====================================================

-- ===================
-- NETTOYAGE PRÉALABLE
-- ===================

-- Supprimer les triggers existants
DROP TRIGGER IF EXISTS update_phase1_dce_timestamp ON phase1_dce;
DROP TRIGGER IF EXISTS update_phase1_entreprises_timestamp ON phase1_entreprises;
DROP TRIGGER IF EXISTS update_phase1_consultations_timestamp ON phase1_consultations;
DROP TRIGGER IF EXISTS update_phase1_offres_timestamp ON phase1_offres;
DROP TRIGGER IF EXISTS update_phase1_contrats_timestamp ON phase1_contrats;
DROP TRIGGER IF EXISTS update_phase1_formalites_timestamp ON phase1_formalites;
DROP TRIGGER IF EXISTS update_phase1_negociations_timestamp ON phase1_negociations;

-- Supprimer les tables existantes (ordre inverse des dépendances)
DROP TABLE IF EXISTS phase1_negociations CASCADE;
DROP TABLE IF EXISTS phase1_prises_references CASCADE;
DROP TABLE IF EXISTS phase1_formalites CASCADE;
DROP TABLE IF EXISTS phase1_contrats CASCADE;
DROP TABLE IF EXISTS phase1_offres CASCADE;
DROP TABLE IF EXISTS phase1_consultations CASCADE;
DROP TABLE IF EXISTS phase1_entreprises CASCADE;
DROP TABLE IF EXISTS phase1_dce CASCADE;

-- Supprimer les types existants
DROP TYPE IF EXISTS dce_status CASCADE;
DROP TYPE IF EXISTS decomposition_prix_type CASCADE;
DROP TYPE IF EXISTS forme_juridique CASCADE;
DROP TYPE IF EXISTS type_qualification CASCADE;
DROP TYPE IF EXISTS recommandation_entreprise CASCADE;
DROP TYPE IF EXISTS statut_offre CASCADE;
DROP TYPE IF EXISTS type_contrat CASCADE;
DROP TYPE IF EXISTS statut_contrat CASCADE;
DROP TYPE IF EXISTS statut_dossier_formalites CASCADE;
DROP TYPE IF EXISTS statut_consultation CASCADE;

-- Supprimer la fonction si existante
DROP FUNCTION IF EXISTS update_phase1_updated_at CASCADE;

-- Supprimer les index orphelins
DROP INDEX IF EXISTS idx_phase1_dce_project;
DROP INDEX IF EXISTS idx_phase1_dce_status;
DROP INDEX IF EXISTS idx_phase1_entreprises_siret;
DROP INDEX IF EXISTS idx_phase1_entreprises_score;
DROP INDEX IF EXISTS idx_phase1_entreprises_location;
DROP INDEX IF EXISTS idx_phase1_consultations_project;
DROP INDEX IF EXISTS idx_phase1_consultations_statut;
DROP INDEX IF EXISTS idx_phase1_offres_consultation;
DROP INDEX IF EXISTS idx_phase1_offres_entreprise;
DROP INDEX IF EXISTS idx_phase1_offres_statut;
DROP INDEX IF EXISTS idx_phase1_offres_score;
DROP INDEX IF EXISTS idx_phase1_contrats_project;
DROP INDEX IF EXISTS idx_phase1_contrats_statut;
DROP INDEX IF EXISTS idx_phase1_formalites_project;
DROP INDEX IF EXISTS idx_phase1_formalites_statut;
DROP INDEX IF EXISTS idx_phase1_prises_ref_offre;
DROP INDEX IF EXISTS idx_phase1_negociations_contrat;

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

-- Statut DCE
CREATE TYPE dce_status AS ENUM (
  'draft',
  'review',
  'ready',
  'sent',
  'closed',
  'archived'
);

-- Type de décomposition prix
CREATE TYPE decomposition_prix_type AS ENUM (
  'dpgf',
  'dqe',
  'bpu'
);

-- Forme juridique entreprise
CREATE TYPE forme_juridique AS ENUM (
  'ei',
  'eurl',
  'sarl',
  'sas',
  'sa',
  'sasu',
  'snc',
  'scea',
  'autre'
);

-- Type qualification
CREATE TYPE type_qualification AS ENUM (
  'qualibat',
  'rge',
  'qualifelec',
  'qualipac',
  'qualisol',
  'qualipv',
  'qualibois',
  'qualigaz',
  'certification_iso',
  'label_artisan',
  'autre'
);

-- Recommandation entreprise
CREATE TYPE recommandation_entreprise AS ENUM (
  'fortement_recommande',
  'recommande',
  'a_etudier',
  'non_recommande'
);

-- Statut offre
CREATE TYPE statut_offre AS ENUM (
  'recue',
  'en_analyse',
  'conforme',
  'non_conforme',
  'retenue',
  'selectionnee',
  'rejetee',
  'retiree'
);

-- Type contrat
CREATE TYPE type_contrat AS ENUM (
  'marche_prive_b2c',
  'marche_prive_b2b',
  'marche_public_mapa',
  'marche_public_ao'
);

-- Statut contrat
CREATE TYPE statut_contrat AS ENUM (
  'brouillon',
  'en_negociation',
  'a_signer',
  'signe_entreprise',
  'signe_mo',
  'notifie',
  'en_cours',
  'termine',
  'resilie',
  'archive'
);

-- Statut dossier formalités
CREATE TYPE statut_dossier_formalites AS ENUM (
  'a_completer',
  'en_cours',
  'en_attente_validation',
  'valide',
  'pret_demarrage'
);

-- Statut consultation
CREATE TYPE statut_consultation AS ENUM (
  'preparation',
  'envoyee',
  'en_cours',
  'cloturee',
  'analyse',
  'attribuee',
  'annulee'
);

-- =============================================================================
-- TABLE: phase1_dce (Dossier de Consultation des Entreprises)
-- =============================================================================

CREATE TABLE phase1_dce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES phase0_projects(id) ON DELETE CASCADE,

  -- Métadonnées
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Pièces du DCE
  reglement_consultation JSONB,
  acte_engagement JSONB,
  decomposition_prix JSONB,
  cadre_memoire_technique JSONB,

  -- Annexes
  annexes JSONB DEFAULT '[]',

  -- Statut
  status dce_status DEFAULT 'draft',

  -- Génération
  generation_info JSONB,

  -- TORP Metadata
  torp_metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id)
);

-- Index
CREATE INDEX idx_phase1_dce_project ON phase1_dce(project_id);
CREATE INDEX idx_phase1_dce_status ON phase1_dce(status);

-- =============================================================================
-- TABLE: phase1_entreprises (Entreprises)
-- =============================================================================

CREATE TABLE phase1_entreprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  identification JSONB NOT NULL,
  siret VARCHAR(14) UNIQUE,

  -- Contact
  contact JSONB NOT NULL,

  -- Qualifications
  qualifications JSONB DEFAULT '[]',

  -- Assurances
  assurances JSONB DEFAULT '[]',

  -- Références de chantiers passés
  references_chantiers JSONB DEFAULT '[]',

  -- Capacités
  capacites JSONB DEFAULT '{}',

  -- Réputation
  reputation JSONB DEFAULT '{}',

  -- Score TORP
  score_torp JSONB,

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_phase1_entreprises_siret ON phase1_entreprises(siret);
CREATE INDEX idx_phase1_entreprises_score ON phase1_entreprises((score_torp->>'scoreGlobal'));
CREATE INDEX idx_phase1_entreprises_location ON phase1_entreprises(
  (identification->'adresse'->>'postalCode')
);

-- =============================================================================
-- TABLE: phase1_consultations (Consultations)
-- =============================================================================

CREATE TABLE phase1_consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES phase0_projects(id) ON DELETE CASCADE,
  dce_id UUID REFERENCES phase1_dce(id),

  -- Paramètres
  parametres JSONB DEFAULT '{}',

  -- Entreprises invitées
  entreprises_invitees JSONB DEFAULT '[]',

  -- Statut
  statut statut_consultation DEFAULT 'preparation',

  -- Résultat
  resultat JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_phase1_consultations_project ON phase1_consultations(project_id);
CREATE INDEX idx_phase1_consultations_statut ON phase1_consultations(statut);

-- =============================================================================
-- TABLE: phase1_offres (Offres)
-- =============================================================================

CREATE TABLE phase1_offres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES phase1_consultations(id) ON DELETE CASCADE,
  entreprise_id UUID REFERENCES phase1_entreprises(id),

  -- Snapshot entreprise
  entreprise JSONB NOT NULL,

  -- Statut
  statut statut_offre DEFAULT 'recue',
  date_reception TIMESTAMPTZ DEFAULT NOW(),

  -- Conformité
  conformite JSONB DEFAULT '{}',

  -- Contenu
  contenu JSONB NOT NULL,

  -- Analyse de l'offre
  analyse_offre JSONB,

  -- Score
  score_offre JSONB,

  -- Documents
  documents JSONB DEFAULT '[]',

  -- Historique
  historique JSONB DEFAULT '[]',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_phase1_offres_consultation ON phase1_offres(consultation_id);
CREATE INDEX idx_phase1_offres_entreprise ON phase1_offres(entreprise_id);
CREATE INDEX idx_phase1_offres_statut ON phase1_offres(statut);
CREATE INDEX idx_phase1_offres_score ON phase1_offres((score_offre->>'scoreGlobal'));

-- =============================================================================
-- TABLE: phase1_contrats (Contrats)
-- =============================================================================

CREATE TABLE phase1_contrats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES phase0_projects(id) ON DELETE CASCADE,
  consultation_id UUID REFERENCES phase1_consultations(id),
  offre_id UUID REFERENCES phase1_offres(id),

  -- Type et mode
  type type_contrat NOT NULL,
  mode wizard_mode NOT NULL,

  -- Parties
  parties JSONB NOT NULL,

  -- Objet
  objet JSONB NOT NULL,

  -- Conditions financières
  conditions_financieres JSONB NOT NULL,

  -- Délais
  delais JSONB NOT NULL,

  -- Garanties
  garanties JSONB DEFAULT '{}',

  -- Clauses
  clauses JSONB DEFAULT '{}',

  -- Annexes
  annexes JSONB DEFAULT '[]',

  -- Signature
  signature JSONB DEFAULT '{}',

  -- Statut
  statut statut_contrat DEFAULT 'brouillon',

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_phase1_contrats_project ON phase1_contrats(project_id);
CREATE INDEX idx_phase1_contrats_statut ON phase1_contrats(statut);

-- =============================================================================
-- TABLE: phase1_formalites (Formalités administratives)
-- =============================================================================

CREATE TABLE phase1_formalites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES phase0_projects(id) ON DELETE CASCADE,

  -- Urbanisme
  urbanisme JSONB DEFAULT '{}',

  -- Déclarations
  declarations JSONB DEFAULT '{}',

  -- Sécurité
  securite JSONB DEFAULT '{}',

  -- Voirie
  voirie JSONB DEFAULT '{}',

  -- Autres
  autres JSONB DEFAULT '{}',

  -- Statut
  statut statut_dossier_formalites DEFAULT 'a_completer',
  progression INTEGER DEFAULT 0,

  -- Alertes
  alertes JSONB DEFAULT '[]',

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id)
);

-- Index
CREATE INDEX idx_phase1_formalites_project ON phase1_formalites(project_id);
CREATE INDEX idx_phase1_formalites_statut ON phase1_formalites(statut);

-- =============================================================================
-- TABLE: phase1_prises_references (Prises de références)
-- =============================================================================

CREATE TABLE phase1_prises_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offre_id UUID NOT NULL REFERENCES phase1_offres(id) ON DELETE CASCADE,
  entreprise_id UUID REFERENCES phase1_entreprises(id),
  reference_id UUID,

  -- Contact
  contact JSONB NOT NULL,

  -- Réponses
  reponses JSONB DEFAULT '[]',

  -- Résultat
  note_globale DECIMAL(3,1),
  recommande BOOLEAN,
  commentaire_global TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_phase1_prises_ref_offre ON phase1_prises_references(offre_id);

-- =============================================================================
-- TABLE: phase1_negociations (Négociations)
-- =============================================================================

CREATE TABLE phase1_negociations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id UUID NOT NULL REFERENCES phase1_contrats(id) ON DELETE CASCADE,

  -- Points de négociation
  points_negociation JSONB DEFAULT '[]',

  -- Historique
  historique JSONB DEFAULT '[]',

  -- Résultat
  resultat JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_phase1_negociations_contrat ON phase1_negociations(contrat_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE phase1_dce ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase1_entreprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase1_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase1_offres ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase1_contrats ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase1_formalites ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase1_prises_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase1_negociations ENABLE ROW LEVEL SECURITY;

-- Policies pour phase1_dce
CREATE POLICY "Users can view own DCE" ON phase1_dce
  FOR SELECT USING (
    project_id IN (SELECT id FROM phase0_projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own DCE" ON phase1_dce
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM phase0_projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own DCE" ON phase1_dce
  FOR UPDATE USING (
    project_id IN (SELECT id FROM phase0_projects WHERE user_id = auth.uid())
  );

-- Policies pour phase1_entreprises (visible par tous les utilisateurs authentifiés)
CREATE POLICY "Authenticated users can view entreprises" ON phase1_entreprises
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert entreprises" ON phase1_entreprises
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Policies pour phase1_consultations
CREATE POLICY "Users can view own consultations" ON phase1_consultations
  FOR SELECT USING (
    project_id IN (SELECT id FROM phase0_projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage own consultations" ON phase1_consultations
  FOR ALL USING (
    project_id IN (SELECT id FROM phase0_projects WHERE user_id = auth.uid())
  );

-- Policies pour phase1_offres
CREATE POLICY "Users can view offres for own consultations" ON phase1_offres
  FOR SELECT USING (
    consultation_id IN (
      SELECT id FROM phase1_consultations WHERE project_id IN (
        SELECT id FROM phase0_projects WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage offres for own consultations" ON phase1_offres
  FOR ALL USING (
    consultation_id IN (
      SELECT id FROM phase1_consultations WHERE project_id IN (
        SELECT id FROM phase0_projects WHERE user_id = auth.uid()
      )
    )
  );

-- Policies pour phase1_contrats
CREATE POLICY "Users can view own contrats" ON phase1_contrats
  FOR SELECT USING (
    project_id IN (SELECT id FROM phase0_projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage own contrats" ON phase1_contrats
  FOR ALL USING (
    project_id IN (SELECT id FROM phase0_projects WHERE user_id = auth.uid())
  );

-- Policies pour phase1_formalites
CREATE POLICY "Users can view own formalites" ON phase1_formalites
  FOR SELECT USING (
    project_id IN (SELECT id FROM phase0_projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage own formalites" ON phase1_formalites
  FOR ALL USING (
    project_id IN (SELECT id FROM phase0_projects WHERE user_id = auth.uid())
  );

-- Policies pour phase1_prises_references
CREATE POLICY "Users can view own prises references" ON phase1_prises_references
  FOR SELECT USING (
    offre_id IN (
      SELECT id FROM phase1_offres WHERE consultation_id IN (
        SELECT id FROM phase1_consultations WHERE project_id IN (
          SELECT id FROM phase0_projects WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage own prises references" ON phase1_prises_references
  FOR ALL USING (
    offre_id IN (
      SELECT id FROM phase1_offres WHERE consultation_id IN (
        SELECT id FROM phase1_consultations WHERE project_id IN (
          SELECT id FROM phase0_projects WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Policies pour phase1_negociations
CREATE POLICY "Users can view own negociations" ON phase1_negociations
  FOR SELECT USING (
    contrat_id IN (
      SELECT id FROM phase1_contrats WHERE project_id IN (
        SELECT id FROM phase0_projects WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage own negociations" ON phase1_negociations
  FOR ALL USING (
    contrat_id IN (
      SELECT id FROM phase1_contrats WHERE project_id IN (
        SELECT id FROM phase0_projects WHERE user_id = auth.uid()
      )
    )
  );

-- =============================================================================
-- TRIGGERS UPDATED_AT
-- =============================================================================

CREATE OR REPLACE FUNCTION update_phase1_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_phase1_dce_timestamp
  BEFORE UPDATE ON phase1_dce
  FOR EACH ROW EXECUTE FUNCTION update_phase1_updated_at();

CREATE TRIGGER update_phase1_entreprises_timestamp
  BEFORE UPDATE ON phase1_entreprises
  FOR EACH ROW EXECUTE FUNCTION update_phase1_updated_at();

CREATE TRIGGER update_phase1_consultations_timestamp
  BEFORE UPDATE ON phase1_consultations
  FOR EACH ROW EXECUTE FUNCTION update_phase1_updated_at();

CREATE TRIGGER update_phase1_offres_timestamp
  BEFORE UPDATE ON phase1_offres
  FOR EACH ROW EXECUTE FUNCTION update_phase1_updated_at();

CREATE TRIGGER update_phase1_contrats_timestamp
  BEFORE UPDATE ON phase1_contrats
  FOR EACH ROW EXECUTE FUNCTION update_phase1_updated_at();

CREATE TRIGGER update_phase1_formalites_timestamp
  BEFORE UPDATE ON phase1_formalites
  FOR EACH ROW EXECUTE FUNCTION update_phase1_updated_at();

CREATE TRIGGER update_phase1_negociations_timestamp
  BEFORE UPDATE ON phase1_negociations
  FOR EACH ROW EXECUTE FUNCTION update_phase1_updated_at();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE phase1_dce IS 'Dossiers de Consultation des Entreprises (DCE) pour la Phase 1';
COMMENT ON TABLE phase1_entreprises IS 'Référentiel des entreprises de travaux';
COMMENT ON TABLE phase1_consultations IS 'Sessions de consultation avec les entreprises';
COMMENT ON TABLE phase1_offres IS 'Offres reçues des entreprises';
COMMENT ON TABLE phase1_contrats IS 'Contrats de travaux générés';
COMMENT ON TABLE phase1_formalites IS 'Formalités administratives avant démarrage chantier';
COMMENT ON TABLE phase1_prises_references IS 'Prises de références auprès d''anciens clients';
COMMENT ON TABLE phase1_negociations IS 'Négociations contractuelles';
