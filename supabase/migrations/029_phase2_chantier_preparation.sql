-- =====================================================
-- Migration 029: Phase 2 - Préparation de Chantier
-- Tables pour la gestion du chantier, réunions, planning, logistique
-- =====================================================

-- =============================================================================
-- ENUM TYPES Phase 2
-- =============================================================================

-- Statut ordre de service
CREATE TYPE statut_ordre_service AS ENUM (
  'brouillon',
  'envoye',
  'accuse_reception',
  'conteste',
  'valide'
);

-- Statut réunion chantier
CREATE TYPE statut_reunion AS ENUM (
  'planifiee',
  'confirmee',
  'en_cours',
  'terminee',
  'annulee',
  'reportee'
);

-- Type de réunion
CREATE TYPE type_reunion AS ENUM (
  'lancement',
  'chantier_hebdo',
  'coordination',
  'reception_partielle',
  'pre_reception',
  'reception',
  'levee_reserves',
  'extraordinaire'
);

-- Statut tâche planning
CREATE TYPE statut_tache AS ENUM (
  'a_planifier',
  'planifiee',
  'en_cours',
  'en_attente',
  'terminee',
  'annulee'
);

-- Type de dépendance
CREATE TYPE type_dependance AS ENUM (
  'fin_debut',      -- FD: B démarre quand A finit
  'debut_debut',    -- DD: B démarre quand A démarre
  'fin_fin',        -- FF: B finit quand A finit
  'debut_fin'       -- DF: B finit quand A démarre
);

-- Statut installation chantier
CREATE TYPE statut_installation AS ENUM (
  'a_preparer',
  'en_preparation',
  'installee',
  'operationnelle',
  'demontee'
);

-- Statut document chantier
CREATE TYPE statut_document_chantier AS ENUM (
  'a_fournir',
  'fourni',
  'valide',
  'expire',
  'non_conforme'
);

-- =============================================================================
-- TABLE: phase2_chantiers (Dossier chantier principal)
-- =============================================================================

CREATE TABLE phase2_chantiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES phase0_projects(id) ON DELETE CASCADE,
  contrat_id UUID REFERENCES phase1_contrats(id),

  -- Identification
  reference VARCHAR(50),
  nom VARCHAR(255) NOT NULL,

  -- Dates
  date_notification DATE,
  date_ordre_service DATE,
  date_debut_prevue DATE,
  date_fin_prevue DATE,
  date_debut_effective DATE,
  date_fin_effective DATE,

  -- Durée
  duree_marche_jours INTEGER,
  delai_execution_jours INTEGER,

  -- Montants
  montant_marche_ht DECIMAL(15,2),
  montant_travaux_sup_ht DECIMAL(15,2) DEFAULT 0,
  montant_total_ht DECIMAL(15,2),

  -- Statut
  statut VARCHAR(30) DEFAULT 'preparation' CHECK (statut IN (
    'preparation', 'ordre_service', 'en_cours', 'suspendu',
    'reception', 'garantie_parfait_achevement', 'clos'
  )),

  -- Avancement
  avancement_global INTEGER DEFAULT 0 CHECK (avancement_global BETWEEN 0 AND 100),

  -- Configuration
  config JSONB DEFAULT '{}',

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id)
);

-- Index
CREATE INDEX idx_phase2_chantiers_project ON phase2_chantiers(project_id);
CREATE INDEX idx_phase2_chantiers_statut ON phase2_chantiers(statut);
CREATE INDEX idx_phase2_chantiers_dates ON phase2_chantiers(date_debut_prevue, date_fin_prevue);

-- =============================================================================
-- TABLE: phase2_ordres_service (Ordres de Service)
-- =============================================================================

CREATE TABLE phase2_ordres_service (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL REFERENCES phase2_chantiers(id) ON DELETE CASCADE,

  -- Numérotation
  numero INTEGER NOT NULL,
  reference VARCHAR(50),

  -- Type
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'demarrage',           -- OS 001: Ordre de commencer
    'suspension',          -- Suspension des travaux
    'reprise',             -- Reprise après suspension
    'prolongation',        -- Prolongation délai
    'travaux_sup',         -- Travaux supplémentaires
    'modification',        -- Modification technique
    'arret_definitif'      -- Arrêt définitif
  )),

  -- Contenu
  objet TEXT NOT NULL,
  description TEXT,

  -- Dates
  date_emission DATE NOT NULL DEFAULT CURRENT_DATE,
  date_effet DATE NOT NULL,
  date_reception DATE,

  -- Impact délai
  impact_delai_jours INTEGER DEFAULT 0,
  nouvelle_date_fin DATE,

  -- Impact financier
  impact_financier_ht DECIMAL(15,2) DEFAULT 0,

  -- Statut
  statut statut_ordre_service DEFAULT 'brouillon',

  -- Signataires
  emetteur JSONB,
  destinataire JSONB,

  -- Accusé réception
  accuse_reception JSONB,

  -- Documents
  documents JSONB DEFAULT '[]',

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(chantier_id, numero)
);

-- Index
CREATE INDEX idx_phase2_os_chantier ON phase2_ordres_service(chantier_id);
CREATE INDEX idx_phase2_os_type ON phase2_ordres_service(type);
CREATE INDEX idx_phase2_os_statut ON phase2_ordres_service(statut);

-- =============================================================================
-- TABLE: phase2_reunions (Réunions de chantier)
-- =============================================================================

CREATE TABLE phase2_reunions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL REFERENCES phase2_chantiers(id) ON DELETE CASCADE,

  -- Identification
  numero INTEGER NOT NULL,
  type type_reunion NOT NULL,

  -- Planification
  titre VARCHAR(255) NOT NULL,
  date_heure TIMESTAMPTZ NOT NULL,
  duree_minutes INTEGER DEFAULT 60,
  lieu VARCHAR(255),

  -- Ordre du jour
  ordre_du_jour JSONB DEFAULT '[]',

  -- Participants
  participants_prevus JSONB DEFAULT '[]',
  participants_presents JSONB DEFAULT '[]',

  -- Statut
  statut statut_reunion DEFAULT 'planifiee',

  -- Compte-rendu
  compte_rendu JSONB,
  decisions JSONB DEFAULT '[]',
  actions JSONB DEFAULT '[]',

  -- Documents
  documents JSONB DEFAULT '[]',
  photos JSONB DEFAULT '[]',

  -- Signatures
  signatures JSONB DEFAULT '[]',

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(chantier_id, numero)
);

-- Index
CREATE INDEX idx_phase2_reunions_chantier ON phase2_reunions(chantier_id);
CREATE INDEX idx_phase2_reunions_type ON phase2_reunions(type);
CREATE INDEX idx_phase2_reunions_date ON phase2_reunions(date_heure);
CREATE INDEX idx_phase2_reunions_statut ON phase2_reunions(statut);

-- =============================================================================
-- TABLE: phase2_planning_lots (Lots du planning)
-- =============================================================================

CREATE TABLE phase2_planning_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL REFERENCES phase2_chantiers(id) ON DELETE CASCADE,

  -- Hiérarchie (WBS)
  parent_id UUID REFERENCES phase2_planning_lots(id),
  ordre INTEGER NOT NULL DEFAULT 0,
  niveau INTEGER NOT NULL DEFAULT 1,
  code_wbs VARCHAR(50),

  -- Identification
  nom VARCHAR(255) NOT NULL,
  description TEXT,

  -- Entreprise
  entreprise_id UUID,
  entreprise_nom VARCHAR(255),

  -- Dates planifiées
  date_debut_prevue DATE,
  date_fin_prevue DATE,
  duree_prevue_jours INTEGER,

  -- Dates réelles
  date_debut_reelle DATE,
  date_fin_reelle DATE,

  -- Avancement
  avancement INTEGER DEFAULT 0 CHECK (avancement BETWEEN 0 AND 100),

  -- Chemin critique
  est_critique BOOLEAN DEFAULT FALSE,
  marge_totale_jours INTEGER,
  marge_libre_jours INTEGER,

  -- Statut
  statut statut_tache DEFAULT 'a_planifier',

  -- Ressources
  ressources JSONB DEFAULT '[]',

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_phase2_lots_chantier ON phase2_planning_lots(chantier_id);
CREATE INDEX idx_phase2_lots_parent ON phase2_planning_lots(parent_id);
CREATE INDEX idx_phase2_lots_dates ON phase2_planning_lots(date_debut_prevue, date_fin_prevue);
CREATE INDEX idx_phase2_lots_critique ON phase2_planning_lots(chantier_id, est_critique) WHERE est_critique = TRUE;

-- =============================================================================
-- TABLE: phase2_planning_taches (Tâches détaillées)
-- =============================================================================

CREATE TABLE phase2_planning_taches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES phase2_planning_lots(id) ON DELETE CASCADE,
  chantier_id UUID NOT NULL REFERENCES phase2_chantiers(id) ON DELETE CASCADE,

  -- Hiérarchie
  parent_id UUID REFERENCES phase2_planning_taches(id),
  ordre INTEGER NOT NULL DEFAULT 0,
  code_wbs VARCHAR(50),

  -- Identification
  nom VARCHAR(255) NOT NULL,
  description TEXT,

  -- Dates planifiées
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  duree_jours INTEGER NOT NULL,

  -- Dates réelles
  date_debut_reelle DATE,
  date_fin_reelle DATE,

  -- Avancement
  avancement INTEGER DEFAULT 0 CHECK (avancement BETWEEN 0 AND 100),

  -- Chemin critique
  est_critique BOOLEAN DEFAULT FALSE,
  marge_totale_jours INTEGER,
  marge_libre_jours INTEGER,

  -- Contraintes
  contrainte_type VARCHAR(20) CHECK (contrainte_type IN ('aucune', 'debut_au_plus_tot', 'debut_au_plus_tard', 'fin_au_plus_tot', 'fin_au_plus_tard', 'date_fixe')),
  contrainte_date DATE,

  -- Statut
  statut statut_tache DEFAULT 'planifiee',

  -- Point d'arrêt
  est_point_arret BOOLEAN DEFAULT FALSE,
  point_arret_description TEXT,
  point_arret_valide BOOLEAN,
  point_arret_date_validation DATE,

  -- Ressources
  ressources JSONB DEFAULT '[]',

  -- Notes
  notes TEXT,

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_phase2_taches_lot ON phase2_planning_taches(lot_id);
CREATE INDEX idx_phase2_taches_chantier ON phase2_planning_taches(chantier_id);
CREATE INDEX idx_phase2_taches_dates ON phase2_planning_taches(date_debut, date_fin);
CREATE INDEX idx_phase2_taches_critique ON phase2_planning_taches(chantier_id, est_critique) WHERE est_critique = TRUE;
CREATE INDEX idx_phase2_taches_point_arret ON phase2_planning_taches(chantier_id, est_point_arret) WHERE est_point_arret = TRUE;

-- =============================================================================
-- TABLE: phase2_planning_dependances (Liens entre tâches)
-- =============================================================================

CREATE TABLE phase2_planning_dependances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL REFERENCES phase2_chantiers(id) ON DELETE CASCADE,

  -- Tâches liées
  tache_predecesseur_id UUID NOT NULL REFERENCES phase2_planning_taches(id) ON DELETE CASCADE,
  tache_successeur_id UUID NOT NULL REFERENCES phase2_planning_taches(id) ON DELETE CASCADE,

  -- Type de lien
  type type_dependance NOT NULL DEFAULT 'fin_debut',

  -- Décalage (lag)
  decalage_jours INTEGER DEFAULT 0,

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tache_predecesseur_id, tache_successeur_id)
);

-- Index
CREATE INDEX idx_phase2_dep_chantier ON phase2_planning_dependances(chantier_id);
CREATE INDEX idx_phase2_dep_pred ON phase2_planning_dependances(tache_predecesseur_id);
CREATE INDEX idx_phase2_dep_succ ON phase2_planning_dependances(tache_successeur_id);

-- =============================================================================
-- TABLE: phase2_installation_chantier (Installation et logistique)
-- =============================================================================

CREATE TABLE phase2_installation_chantier (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL REFERENCES phase2_chantiers(id) ON DELETE CASCADE,

  -- Base vie
  base_vie JSONB DEFAULT '{
    "vestiaires": {"prevu": false, "installe": false, "surface_m2": 0},
    "sanitaires": {"prevu": false, "installe": false, "type": ""},
    "refectoire": {"prevu": false, "installe": false, "equipements": []},
    "bureau_chantier": {"prevu": false, "installe": false}
  }',

  -- Branchements provisoires
  branchements JSONB DEFAULT '{
    "electricite": {"demande": false, "raccorde": false, "puissance_kw": 0},
    "eau": {"demande": false, "raccorde": false},
    "assainissement": {"prevu": false, "installe": false}
  }',

  -- Zones
  zones JSONB DEFAULT '{
    "stockage_materiaux": [],
    "stockage_dechets": [],
    "circulation_engins": [],
    "stationnement": []
  }',

  -- Signalisation
  signalisation JSONB DEFAULT '{
    "panneau_chantier": false,
    "panneau_entreprise": false,
    "consignes_securite": false,
    "plan_evacuation": false,
    "balisage_perimetre": false
  }',

  -- Sécurité
  securite JSONB DEFAULT '{
    "extincteurs": {"nombre": 0, "emplacements": []},
    "trousse_secours": false,
    "numeros_urgence_affiches": false,
    "registre_securite": false
  }',

  -- Statut global
  statut statut_installation DEFAULT 'a_preparer',
  checklist_completude INTEGER DEFAULT 0,

  -- Plan installation
  plan_installation_url TEXT,

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(chantier_id)
);

-- Index
CREATE INDEX idx_phase2_installation_chantier ON phase2_installation_chantier(chantier_id);

-- =============================================================================
-- TABLE: phase2_approvisionnements (Planning approvisionnements)
-- =============================================================================

CREATE TABLE phase2_approvisionnements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL REFERENCES phase2_chantiers(id) ON DELETE CASCADE,
  tache_id UUID REFERENCES phase2_planning_taches(id),

  -- Identification
  designation VARCHAR(255) NOT NULL,
  reference VARCHAR(100),
  fournisseur VARCHAR(255),

  -- Quantités
  quantite DECIMAL(15,3) NOT NULL,
  unite VARCHAR(20),

  -- Dates
  date_commande DATE,
  delai_fabrication_jours INTEGER,
  date_livraison_prevue DATE,
  date_livraison_reelle DATE,

  -- Statut
  statut VARCHAR(20) DEFAULT 'a_commander' CHECK (statut IN (
    'a_commander', 'commande', 'en_fabrication', 'expedie', 'livre', 'controle', 'conforme', 'non_conforme'
  )),

  -- Contrôle réception
  controle_reception JSONB,

  -- Documents
  bon_commande_url TEXT,
  bon_livraison_url TEXT,

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_phase2_appro_chantier ON phase2_approvisionnements(chantier_id);
CREATE INDEX idx_phase2_appro_tache ON phase2_approvisionnements(tache_id);
CREATE INDEX idx_phase2_appro_livraison ON phase2_approvisionnements(date_livraison_prevue);
CREATE INDEX idx_phase2_appro_statut ON phase2_approvisionnements(statut);

-- =============================================================================
-- TABLE: phase2_dechets (Gestion des déchets)
-- =============================================================================

CREATE TABLE phase2_dechets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL REFERENCES phase2_chantiers(id) ON DELETE CASCADE,

  -- Type de déchet
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'gravats_inertes', 'dib', 'bois', 'metaux', 'platre',
    'laine_minerale', 'polystyrene', 'dds', 'amiante', 'autre'
  )),

  -- Contenant
  contenant VARCHAR(30) CHECK (contenant IN ('benne', 'big_bag', 'fut', 'conteneur')),
  volume_m3 DECIMAL(10,2),

  -- Évacuation
  date_pose DATE,
  date_enlevement DATE,
  prestataire VARCHAR(255),

  -- Traçabilité
  bsd_numero VARCHAR(50),
  bsd_url TEXT,
  ticket_pesee_url TEXT,
  poids_tonnes DECIMAL(10,3),

  -- Coût
  cout_ht DECIMAL(10,2),

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_phase2_dechets_chantier ON phase2_dechets(chantier_id);
CREATE INDEX idx_phase2_dechets_type ON phase2_dechets(type);

-- =============================================================================
-- TABLE: phase2_documents_chantier (Documents obligatoires chantier)
-- =============================================================================

CREATE TABLE phase2_documents_chantier (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL REFERENCES phase2_chantiers(id) ON DELETE CASCADE,

  -- Type document
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'pc_dp', 'dict', 'doc', 'ppsps', 'pgc', 'registre_sps',
    'attestation_assurance', 'plans_execution', 'planning',
    'annuaire_contacts', 'reglement_chantier', 'consignes_securite',
    'fds_produits', 'autorisation_voirie', 'arrete_circulation',
    'constat_huissier', 'autre'
  )),

  -- Identification
  nom VARCHAR(255) NOT NULL,
  description TEXT,

  -- Fichier
  file_url TEXT,
  file_name VARCHAR(255),

  -- Validité
  date_emission DATE,
  date_expiration DATE,

  -- Statut
  statut statut_document_chantier DEFAULT 'a_fournir',

  -- Fournisseur
  fourni_par VARCHAR(100), -- MO, MOE, entreprise, etc.

  -- Vérification
  verifie_le DATE,
  verifie_par VARCHAR(255),
  commentaire_verification TEXT,

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_phase2_docs_chantier ON phase2_documents_chantier(chantier_id);
CREATE INDEX idx_phase2_docs_type ON phase2_documents_chantier(type);
CREATE INDEX idx_phase2_docs_statut ON phase2_documents_chantier(statut);

-- =============================================================================
-- TABLE: phase2_journal_chantier (Journal quotidien)
-- =============================================================================

CREATE TABLE phase2_journal_chantier (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL REFERENCES phase2_chantiers(id) ON DELETE CASCADE,

  -- Date
  date_journal DATE NOT NULL,

  -- Météo
  meteo JSONB DEFAULT '{"matin": "", "apres_midi": "", "temperature_min": null, "temperature_max": null, "intemperie": false}',

  -- Effectifs présents
  effectifs JSONB DEFAULT '[]',
  effectif_total INTEGER DEFAULT 0,

  -- Travaux réalisés
  travaux_realises JSONB DEFAULT '[]',

  -- Observations
  observations TEXT,
  incidents TEXT,

  -- Visiteurs
  visiteurs JSONB DEFAULT '[]',

  -- Photos
  photos JSONB DEFAULT '[]',

  -- Validations
  redige_par VARCHAR(255),
  valide_par VARCHAR(255),
  valide_le TIMESTAMPTZ,

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(chantier_id, date_journal)
);

-- Index
CREATE INDEX idx_phase2_journal_chantier ON phase2_journal_chantier(chantier_id);
CREATE INDEX idx_phase2_journal_date ON phase2_journal_chantier(date_journal);

-- =============================================================================
-- TABLE: phase2_checklist_demarrage (Checklist avant démarrage)
-- =============================================================================

CREATE TABLE phase2_checklist_demarrage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL REFERENCES phase2_chantiers(id) ON DELETE CASCADE,

  -- Checklist items (stocké en JSONB pour flexibilité)
  items JSONB DEFAULT '[]',

  -- Score
  items_total INTEGER DEFAULT 0,
  items_valides INTEGER DEFAULT 0,
  pourcentage_completion INTEGER DEFAULT 0,

  -- Statut
  est_complet BOOLEAN DEFAULT FALSE,
  peut_demarrer BOOLEAN DEFAULT FALSE,

  -- Validation
  valide_par VARCHAR(255),
  valide_le TIMESTAMPTZ,
  commentaires TEXT,

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(chantier_id)
);

-- Index
CREATE INDEX idx_phase2_checklist_chantier ON phase2_checklist_demarrage(chantier_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE phase2_chantiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase2_ordres_service ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase2_reunions ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase2_planning_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase2_planning_taches ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase2_planning_dependances ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase2_installation_chantier ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase2_approvisionnements ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase2_dechets ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase2_documents_chantier ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase2_journal_chantier ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase2_checklist_demarrage ENABLE ROW LEVEL SECURITY;

-- Policies pour phase2_chantiers
CREATE POLICY "Users can view own chantiers" ON phase2_chantiers
  FOR SELECT USING (
    project_id IN (SELECT id FROM phase0_projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage own chantiers" ON phase2_chantiers
  FOR ALL USING (
    project_id IN (SELECT id FROM phase0_projects WHERE user_id = auth.uid())
  );

-- Policies pour les autres tables (via chantier_id)
CREATE POLICY "Users can view own OS" ON phase2_ordres_service
  FOR SELECT USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can manage own OS" ON phase2_ordres_service
  FOR ALL USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can view own reunions" ON phase2_reunions
  FOR SELECT USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can manage own reunions" ON phase2_reunions
  FOR ALL USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can view own lots" ON phase2_planning_lots
  FOR SELECT USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can manage own lots" ON phase2_planning_lots
  FOR ALL USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can view own taches" ON phase2_planning_taches
  FOR SELECT USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can manage own taches" ON phase2_planning_taches
  FOR ALL USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can view own dependances" ON phase2_planning_dependances
  FOR SELECT USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can manage own dependances" ON phase2_planning_dependances
  FOR ALL USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can view own installation" ON phase2_installation_chantier
  FOR SELECT USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can manage own installation" ON phase2_installation_chantier
  FOR ALL USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can view own appro" ON phase2_approvisionnements
  FOR SELECT USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can manage own appro" ON phase2_approvisionnements
  FOR ALL USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can view own dechets" ON phase2_dechets
  FOR SELECT USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can manage own dechets" ON phase2_dechets
  FOR ALL USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can view own docs chantier" ON phase2_documents_chantier
  FOR SELECT USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can manage own docs chantier" ON phase2_documents_chantier
  FOR ALL USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can view own journal" ON phase2_journal_chantier
  FOR SELECT USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can manage own journal" ON phase2_journal_chantier
  FOR ALL USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can view own checklist" ON phase2_checklist_demarrage
  FOR SELECT USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can manage own checklist" ON phase2_checklist_demarrage
  FOR ALL USING (
    chantier_id IN (SELECT id FROM phase2_chantiers WHERE project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    ))
  );

-- =============================================================================
-- TRIGGERS UPDATED_AT
-- =============================================================================

CREATE OR REPLACE FUNCTION update_phase2_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_phase2_chantiers_timestamp
  BEFORE UPDATE ON phase2_chantiers
  FOR EACH ROW EXECUTE FUNCTION update_phase2_updated_at();

CREATE TRIGGER update_phase2_os_timestamp
  BEFORE UPDATE ON phase2_ordres_service
  FOR EACH ROW EXECUTE FUNCTION update_phase2_updated_at();

CREATE TRIGGER update_phase2_reunions_timestamp
  BEFORE UPDATE ON phase2_reunions
  FOR EACH ROW EXECUTE FUNCTION update_phase2_updated_at();

CREATE TRIGGER update_phase2_lots_timestamp
  BEFORE UPDATE ON phase2_planning_lots
  FOR EACH ROW EXECUTE FUNCTION update_phase2_updated_at();

CREATE TRIGGER update_phase2_taches_timestamp
  BEFORE UPDATE ON phase2_planning_taches
  FOR EACH ROW EXECUTE FUNCTION update_phase2_updated_at();

CREATE TRIGGER update_phase2_installation_timestamp
  BEFORE UPDATE ON phase2_installation_chantier
  FOR EACH ROW EXECUTE FUNCTION update_phase2_updated_at();

CREATE TRIGGER update_phase2_appro_timestamp
  BEFORE UPDATE ON phase2_approvisionnements
  FOR EACH ROW EXECUTE FUNCTION update_phase2_updated_at();

CREATE TRIGGER update_phase2_docs_timestamp
  BEFORE UPDATE ON phase2_documents_chantier
  FOR EACH ROW EXECUTE FUNCTION update_phase2_updated_at();

CREATE TRIGGER update_phase2_journal_timestamp
  BEFORE UPDATE ON phase2_journal_chantier
  FOR EACH ROW EXECUTE FUNCTION update_phase2_updated_at();

CREATE TRIGGER update_phase2_checklist_timestamp
  BEFORE UPDATE ON phase2_checklist_demarrage
  FOR EACH ROW EXECUTE FUNCTION update_phase2_updated_at();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE phase2_chantiers IS 'Dossier principal du chantier Phase 2';
COMMENT ON TABLE phase2_ordres_service IS 'Ordres de Service (OS) du chantier';
COMMENT ON TABLE phase2_reunions IS 'Réunions de chantier (lancement, hebdo, réception)';
COMMENT ON TABLE phase2_planning_lots IS 'Lots du planning (niveau WBS)';
COMMENT ON TABLE phase2_planning_taches IS 'Tâches détaillées du planning';
COMMENT ON TABLE phase2_planning_dependances IS 'Liens de dépendance entre tâches';
COMMENT ON TABLE phase2_installation_chantier IS 'Installation et logistique chantier';
COMMENT ON TABLE phase2_approvisionnements IS 'Planning des approvisionnements';
COMMENT ON TABLE phase2_dechets IS 'Gestion et traçabilité des déchets';
COMMENT ON TABLE phase2_documents_chantier IS 'Documents obligatoires du chantier';
COMMENT ON TABLE phase2_journal_chantier IS 'Journal quotidien du chantier';
COMMENT ON TABLE phase2_checklist_demarrage IS 'Checklist avant démarrage des travaux';
