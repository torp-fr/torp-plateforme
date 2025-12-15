-- Migration 032: Phase 4 - Réception & Garanties
-- Date: 2025-12-15
-- Description: Tables pour OPR, Réserves, Réception, Garanties, DOE, DIUO
-- Priority: CRITICAL - Required for Phase 4 functionality

-- ============================================
-- ENUMS
-- ============================================

DO $$ BEGIN
  CREATE TYPE reserve_gravite AS ENUM (
    'mineure',      -- Esthétique, n'empêche pas l'usage
    'majeure',      -- Fonctionnel mais non bloquant
    'grave',        -- Usage compromis
    'non_conformite_substantielle'  -- Empêche la réception
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE reserve_statut AS ENUM (
    'ouverte',
    'en_cours',
    'levee',
    'contestee',
    'expiree'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE reception_decision AS ENUM (
    'acceptee_sans_reserve',
    'acceptee_avec_reserves',
    'refusee',
    'reportee'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE garantie_type AS ENUM (
    'parfait_achevement',    -- 1 an
    'biennale',              -- 2 ans
    'decennale',             -- 10 ans
    'vices_caches'           -- 10 ans après découverte
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE desordre_statut AS ENUM (
    'signale',
    'diagnostic',
    'en_reparation',
    'repare',
    'conteste',
    'prescrit'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE document_doe_type AS ENUM (
    'plan_execution',
    'notice_technique',
    'fiche_materiau',
    'pv_controle',
    'certificat',
    'garantie',
    'autre'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE participant_role_phase4 AS ENUM (
    'maitre_ouvrage',
    'maitre_oeuvre',
    'entreprise',
    'bureau_controle',
    'coordonnateur_sps',
    'expert',
    'assureur'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- TABLE: OPR Sessions
-- ============================================

CREATE TABLE IF NOT EXISTS public.opr_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL,

  -- Planning
  date_opr DATE NOT NULL,
  heure_debut VARCHAR(10),
  heure_fin VARCHAR(10),
  lieu VARCHAR(500),
  duree_estimee_minutes INT DEFAULT 120,

  -- Statut
  statut VARCHAR(20) DEFAULT 'planifiee' CHECK (statut IN ('planifiee', 'en_cours', 'terminee', 'annulee')),

  -- Convocation
  convocation_envoyee BOOLEAN DEFAULT false,
  date_convocation TIMESTAMPTZ,
  mode_convocation TEXT[] DEFAULT '{}',

  -- Participants (JSONB array)
  participants JSONB DEFAULT '[]',
  -- Structure: [{ id, nom, prenom, role, societe, email, telephone, present, represente, represente_par, signature, date_signature }]

  -- Contrôles effectués
  controles JSONB DEFAULT '[]',
  -- Structure: [{ id, lot, categorie, point, description, obligatoire, statut, commentaire, photos, reserve_id }]

  -- Réserves (stockées aussi séparément pour requêtes)
  reserves JSONB DEFAULT '[]',

  -- Documents vérifiés
  documents_verifies JSONB DEFAULT '[]',
  -- Structure: [{ id, type, nom, obligatoire, present, conforme, commentaire, fichier }]

  -- Photos générales
  photos_generales TEXT[] DEFAULT '{}',

  -- Résumé
  nombre_reserves INT DEFAULT 0,
  reserves_bloquantes INT DEFAULT 0,
  taux_conformite DECIMAL(5,2),

  -- Documents
  checklist_template_id VARCHAR(100),
  pv_genere BOOLEAN DEFAULT false,
  pv_document_path VARCHAR(500),

  -- Métadonnées
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: Réserves
-- ============================================

CREATE TABLE IF NOT EXISTS public.reserves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL,
  opr_session_id UUID REFERENCES opr_sessions(id) ON DELETE SET NULL,
  reception_id UUID,

  -- Identification
  numero INT NOT NULL,
  reference VARCHAR(50), -- REF-2025-001

  -- Localisation
  lot VARCHAR(100),
  piece VARCHAR(200),
  localisation VARCHAR(500), -- "Salle de bain - Mur nord"
  coordonnees_photo JSONB, -- { x, y } position sur plan

  -- Description
  nature VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  gravite reserve_gravite NOT NULL DEFAULT 'majeure',
  statut reserve_statut NOT NULL DEFAULT 'ouverte',

  -- Photos (JSONB array)
  photos JSONB DEFAULT '[]',
  -- Structure: [{ id, url, legende, date_capture, type: 'avant'|'apres'|'detail' }]

  -- Entreprise responsable
  entreprise_id UUID,
  entreprise_nom VARCHAR(200),
  entreprise_contact JSONB,

  -- Délais
  delai_levee_jours INT DEFAULT 30,
  date_echeance DATE,

  -- Levée
  date_levee DATE,
  levee_par UUID,
  commentaire_levee TEXT,
  photos_apres JSONB DEFAULT '[]',
  pv_levee_id UUID,

  -- Contestation
  contestee BOOLEAN DEFAULT false,
  motif_contestation TEXT,
  date_contestation DATE,

  -- Coût
  cout_estime DECIMAL(12,2),

  -- Relances
  nombre_relances INT DEFAULT 0,
  derniere_relance_at TIMESTAMPTZ,

  -- Métadonnées
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: Réceptions
-- ============================================

CREATE TABLE IF NOT EXISTS public.receptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL,
  opr_session_id UUID REFERENCES opr_sessions(id),

  -- Type
  type_reception VARCHAR(30) DEFAULT 'travaux' CHECK (type_reception IN ('travaux', 'partielle', 'lot')),
  lot_ids UUID[] DEFAULT '{}',

  -- Date et décision
  date_reception DATE NOT NULL,
  lieu VARCHAR(500),
  decision reception_decision NOT NULL,
  motif_refus TEXT,
  date_nouvelle_opr DATE, -- Si reportée

  -- Réserves associées
  reserve_ids UUID[] DEFAULT '{}',
  nombre_reserves INT DEFAULT 0,
  nombre_reserves_levees INT DEFAULT 0,

  -- Délai réserves
  delai_levee_reserves_jours INT DEFAULT 90,
  date_limite_levee DATE,

  -- PV
  pv_genere BOOLEAN DEFAULT false,
  pv_document_path VARCHAR(500),
  pv_signe BOOLEAN DEFAULT false,

  -- Signataires
  signataires JSONB DEFAULT '[]',
  -- Structure: [{ id, participant_id, role, nom, entreprise, signature, date_signature, mention_manuscrite }]

  -- Effets juridiques
  transfert_garde BOOLEAN DEFAULT false,
  date_transfert_garde DATE,
  demarrage_garanties BOOLEAN DEFAULT false,
  date_demarrage_garanties DATE,

  -- Garanties (calculées à la signature)
  date_debut_garanties DATE,
  date_fin_parfait_achevement DATE,
  date_fin_biennale DATE,
  date_fin_decennale DATE,

  -- Financier
  solde_du DECIMAL(12,2),
  retenue_garantie DECIMAL(12,2),
  retenue_garantie_taux DECIMAL(5,2) DEFAULT 5.00,
  montant_reserves_retenu DECIMAL(12,2),
  retenue_liberee BOOLEAN DEFAULT false,
  retenue_liberee_at TIMESTAMPTZ,

  -- Métadonnées
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: Visites de levée de réserves
-- ============================================

CREATE TABLE IF NOT EXISTS public.visites_levee_reserves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL,
  reception_id UUID REFERENCES receptions(id),

  -- Date et participants
  date_visite DATE NOT NULL,
  participants JSONB DEFAULT '[]',

  -- Réserves contrôlées
  reserves_controlees JSONB DEFAULT '[]',
  -- Structure: [{ reserve_id, statut, commentaire, photos, nouveau_delai }]

  -- Résultat global
  toutes_levees BOOLEAN DEFAULT false,
  nouvelles_reserves JSONB DEFAULT '[]',

  -- PV
  pv_levee_url VARCHAR(500),

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: Garanties
-- ============================================

CREATE TABLE IF NOT EXISTS public.garanties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL,
  reception_id UUID REFERENCES receptions(id),

  -- Type et durée
  type garantie_type NOT NULL,
  duree_annees INT NOT NULL,

  -- Dates
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,

  -- Périmètre
  perimetre TEXT,
  exclusions TEXT[] DEFAULT '{}',

  -- Entreprise/Assurance
  entreprise_id UUID,
  entreprise_nom VARCHAR(200),
  assurance_id UUID,
  assurance_nom VARCHAR(200),
  numero_police VARCHAR(100),

  -- Statut
  active BOOLEAN DEFAULT true,
  expiree BOOLEAN DEFAULT false,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: Désordres (Sinistres garantie)
-- ============================================

CREATE TABLE IF NOT EXISTS public.desordres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL,
  reception_id UUID REFERENCES receptions(id),
  garantie_id UUID REFERENCES garanties(id),

  -- Identification
  numero VARCHAR(50) NOT NULL,
  reference VARCHAR(100),

  -- Dates
  date_decouverte DATE NOT NULL,
  date_signalement DATE,

  -- Description
  nature VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  localisation VARCHAR(500),
  gravite VARCHAR(20) CHECK (gravite IN ('faible', 'moyenne', 'grave', 'critique')),

  -- Classification
  type_desordre VARCHAR(100), -- infiltration, fissure, defaut_isolation, etc.
  garantie_applicable garantie_type,
  statut desordre_statut NOT NULL DEFAULT 'signale',

  -- Photos et documents
  photos JSONB DEFAULT '[]',
  documents JSONB DEFAULT '[]',

  -- Signalement entreprise
  signalement_entreprise JSONB,
  -- Structure: { date, mode, reference_envoi, accuse }

  -- Diagnostic
  diagnostic_date DATE,
  diagnostic_resultat TEXT,
  responsabilite_acceptee BOOLEAN,
  motif_contestation TEXT,

  -- Expertise
  expertise_requise BOOLEAN DEFAULT false,
  expert_id UUID,
  expert_nom VARCHAR(200),
  expert_contact JSONB,
  rapport_expertise_path VARCHAR(500),
  conclusions_expertise TEXT,

  -- Réparation
  reparation_planifiee DATE,
  reparation_realisee DATE,
  cout_reparation DECIMAL(12,2),
  reparation_conforme BOOLEAN,
  travaux_description TEXT,
  travaux_realises_par VARCHAR(200),

  -- Assurance
  declaration_assurance JSONB,
  -- Structure: { date, numero_sinistre, statut, indemnisation }
  assureur_notifie BOOLEAN DEFAULT false,
  assureur_reference VARCHAR(100),

  -- Coûts
  cout_estime DECIMAL(12,2),
  cout_reel DECIMAL(12,2),
  prise_en_charge VARCHAR(50), -- entreprise, assureur, maitre_ouvrage

  -- Métadonnées
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: DOE (Dossier des Ouvrages Exécutés)
-- ============================================

CREATE TABLE IF NOT EXISTS public.doe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL,
  reception_id UUID REFERENCES receptions(id),

  -- Statut
  statut VARCHAR(20) DEFAULT 'en_constitution' CHECK (statut IN ('en_constitution', 'complet', 'remis', 'valide')),

  -- Documents (JSONB)
  documents JSONB DEFAULT '[]',
  -- Structure: [{ id, type, categorie, lot, nom, description, reference, fichier_url, format, taille_mo, obligatoire, valide, date_validation, valide_par, date_document, date_expiration, uploaded_at, uploaded_by }]

  -- Sections spécifiques
  plans_execution JSONB DEFAULT '[]',
  notices_techniques JSONB DEFAULT '[]',
  fiches_materiaux JSONB DEFAULT '[]',
  pv_controles JSONB DEFAULT '[]',
  certificats JSONB DEFAULT '[]',
  garanties_docs JSONB DEFAULT '[]',

  -- Documents obligatoires manquants
  documents_manquants TEXT[] DEFAULT '{}',

  -- Complétude
  pourcentage_complet DECIMAL(5,2) DEFAULT 0,

  -- Validation
  valide BOOLEAN DEFAULT false,
  validated_at TIMESTAMPTZ,
  validated_by UUID,

  -- Remise
  date_remise TIMESTAMPTZ,
  remis_a JSONB, -- { nom, email }
  format_remise VARCHAR(20), -- numerique, papier, mixte

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: DIUO (Dossier d'Intervention Ultérieure)
-- ============================================

CREATE TABLE IF NOT EXISTS public.diuo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL,

  -- Statut
  statut VARCHAR(20) DEFAULT 'en_constitution' CHECK (statut IN ('en_constitution', 'complet', 'remis')),
  date_remise TIMESTAMPTZ,

  -- Descriptif ouvrage
  descriptif JSONB,
  -- Structure: { adresse, maitre_ouvrage, annee_construction, surface, niveaux, acces }

  -- Zones et risques
  zones_risques JSONB DEFAULT '[]',
  -- Structure: [{ id, nom, localisation, risques: [{nature, description, gravite, permanent}], mesures: [{type, description, obligatoire}], consignes, habilitations }]

  moyens_acces JSONB DEFAULT '[]',
  -- Structure: [{ id, localisation, type, description, contraintes }]

  reseaux JSONB DEFAULT '[]',
  -- Structure: [{ id, type, localisation, organe_coupure, observations }]

  -- Mesures générales
  mesures_generales TEXT[] DEFAULT '{}',
  epi_recommandes TEXT[] DEFAULT '{}',

  -- Documents
  documents TEXT[] DEFAULT '{}',
  plans_path VARCHAR(500),
  document_path VARCHAR(500),

  -- Validation
  valide BOOLEAN DEFAULT false,
  validated_at TIMESTAMPTZ,
  validated_by UUID,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: Carnets de Santé
-- ============================================

CREATE TABLE IF NOT EXISTS public.carnets_sante (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL,
  doe_id UUID REFERENCES doe(id),

  -- Fiche signalétique
  adresse VARCHAR(500),
  surface DECIMAL(10,2),
  annee_construction INT,
  annee_renovation INT,

  -- Historique travaux
  travaux JSONB DEFAULT '[]',
  -- Structure: [{ date, nature, entreprise, montant, lot }]

  -- Garanties actives
  garanties_actives JSONB DEFAULT '[]',
  -- Structure: [{ type, date_debut, date_fin, entreprise, assurance }]

  -- Équipements (JSONB)
  equipements JSONB DEFAULT '[]',
  -- Structure: [{ id, categorie, nom, marque, modele, date_installation, garantie_fin, entretien_frequence }]

  -- Entretiens programmés
  entretiens_programmes JSONB DEFAULT '[]',
  -- Structure: [{ id, equipement, nature, periodicite, periodicite_mois, derniere_realisation, prochaine_echeance, prestataire, cout_estime, obligatoire, rappel_envoye }]

  -- Historique entretiens
  entretiens_realises JSONB DEFAULT '[]',
  -- Structure: [{ id, entretien_programme_id, equipement, date, nature, prestataire, cout, observations, facture_url, prochain_entretien }]

  -- Contacts utiles
  contacts JSONB DEFAULT '[]',
  -- Structure: [{ role, nom, telephone, email }]

  -- Recommandations futures
  travaux_futurs_recommandes JSONB DEFAULT '[]',
  -- Structure: [{ nature, priorite, echeance, cout_estime }]

  -- Consommations
  consommations JSONB DEFAULT '[]',
  -- Structure: [{ id, type, annee, mois, valeur, unite }]

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: Retenues de Garantie
-- ============================================

CREATE TABLE IF NOT EXISTS public.retenues_garantie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID NOT NULL,
  reception_id UUID REFERENCES receptions(id),
  entreprise_id UUID,

  -- Montants
  montant_total DECIMAL(12,2) NOT NULL,
  pourcentage DECIMAL(5,2) DEFAULT 5.00,
  montant_marche_ht DECIMAL(12,2),

  -- Dates
  date_constitution DATE, -- = date réception
  date_liberation_prevue DATE, -- = réception + 1 an
  date_liberation_effective DATE,

  -- Consignation
  consignation_type VARCHAR(30), -- compte_sequestre, caution_bancaire, retenue_directe
  consignation_reference VARCHAR(100),
  organisme_consignataire VARCHAR(200),

  -- Statut
  statut VARCHAR(30) DEFAULT 'retenue' CHECK (statut IN ('retenue', 'partiellement_liberee', 'liberee', 'consommee')),
  liberable BOOLEAN DEFAULT false,
  liberee BOOLEAN DEFAULT false,
  liberee_at TIMESTAMPTZ,
  montant_libere DECIMAL(12,2) DEFAULT 0,

  -- Consommation (si désordres non réparés)
  montant_consomme DECIMAL(12,2) DEFAULT 0,
  motifs_consommation JSONB DEFAULT '[]',
  -- Structure: [{ date, montant, motif, reserve_id, desordre_id }]

  -- Retenues pour réserves non levées
  retenue_reserves DECIMAL(12,2) DEFAULT 0,
  reserves_non_levees UUID[] DEFAULT '{}',

  -- Demandes de libération
  demandes_liberation JSONB DEFAULT '[]',
  -- Structure: [{ date, montant, statut, motif_refus }]

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEX
-- ============================================

CREATE INDEX IF NOT EXISTS idx_opr_sessions_chantier ON opr_sessions(chantier_id);
CREATE INDEX IF NOT EXISTS idx_opr_sessions_date ON opr_sessions(date_opr);
CREATE INDEX IF NOT EXISTS idx_opr_sessions_statut ON opr_sessions(statut);

CREATE INDEX IF NOT EXISTS idx_reserves_chantier ON reserves(chantier_id);
CREATE INDEX IF NOT EXISTS idx_reserves_opr ON reserves(opr_session_id);
CREATE INDEX IF NOT EXISTS idx_reserves_statut ON reserves(statut);
CREATE INDEX IF NOT EXISTS idx_reserves_gravite ON reserves(gravite);
CREATE INDEX IF NOT EXISTS idx_reserves_entreprise ON reserves(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_reserves_date_echeance ON reserves(date_echeance);

CREATE INDEX IF NOT EXISTS idx_receptions_chantier ON receptions(chantier_id);
CREATE INDEX IF NOT EXISTS idx_receptions_date ON receptions(date_reception);
CREATE INDEX IF NOT EXISTS idx_receptions_decision ON receptions(decision);

CREATE INDEX IF NOT EXISTS idx_garanties_chantier ON garanties(chantier_id);
CREATE INDEX IF NOT EXISTS idx_garanties_reception ON garanties(reception_id);
CREATE INDEX IF NOT EXISTS idx_garanties_type ON garanties(type);
CREATE INDEX IF NOT EXISTS idx_garanties_date_fin ON garanties(date_fin);

CREATE INDEX IF NOT EXISTS idx_desordres_chantier ON desordres(chantier_id);
CREATE INDEX IF NOT EXISTS idx_desordres_reception ON desordres(reception_id);
CREATE INDEX IF NOT EXISTS idx_desordres_statut ON desordres(statut);
CREATE INDEX IF NOT EXISTS idx_desordres_garantie ON desordres(garantie_applicable);

CREATE INDEX IF NOT EXISTS idx_doe_chantier ON doe(chantier_id);
CREATE INDEX IF NOT EXISTS idx_diuo_chantier ON diuo(chantier_id);
CREATE INDEX IF NOT EXISTS idx_carnets_sante_chantier ON carnets_sante(chantier_id);
CREATE INDEX IF NOT EXISTS idx_retenues_garantie_chantier ON retenues_garantie(chantier_id);
CREATE INDEX IF NOT EXISTS idx_visites_levee_chantier ON visites_levee_reserves(chantier_id);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE opr_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserves ENABLE ROW LEVEL SECURITY;
ALTER TABLE receptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE garanties ENABLE ROW LEVEL SECURITY;
ALTER TABLE desordres ENABLE ROW LEVEL SECURITY;
ALTER TABLE doe ENABLE ROW LEVEL SECURITY;
ALTER TABLE diuo ENABLE ROW LEVEL SECURITY;
ALTER TABLE carnets_sante ENABLE ROW LEVEL SECURITY;
ALTER TABLE retenues_garantie ENABLE ROW LEVEL SECURITY;
ALTER TABLE visites_levee_reserves ENABLE ROW LEVEL SECURITY;

-- Policies pour opr_sessions
DROP POLICY IF EXISTS "Users can view their OPR sessions" ON opr_sessions;
CREATE POLICY "Users can view their OPR sessions"
  ON opr_sessions FOR SELECT
  USING (created_by = auth.uid() OR auth.uid() IN (
    SELECT user_id FROM user_profiles WHERE role = 'admin'
  ));

DROP POLICY IF EXISTS "Users can manage their OPR sessions" ON opr_sessions;
CREATE POLICY "Users can manage their OPR sessions"
  ON opr_sessions FOR ALL
  USING (created_by = auth.uid() OR auth.uid() IN (
    SELECT user_id FROM user_profiles WHERE role = 'admin'
  ));

-- Policies pour reserves
DROP POLICY IF EXISTS "Users can view their reserves" ON reserves;
CREATE POLICY "Users can view their reserves"
  ON reserves FOR SELECT
  USING (created_by = auth.uid() OR auth.uid() IN (
    SELECT user_id FROM user_profiles WHERE role = 'admin'
  ));

DROP POLICY IF EXISTS "Users can manage their reserves" ON reserves;
CREATE POLICY "Users can manage their reserves"
  ON reserves FOR ALL
  USING (created_by = auth.uid() OR auth.uid() IN (
    SELECT user_id FROM user_profiles WHERE role = 'admin'
  ));

-- Policies pour receptions
DROP POLICY IF EXISTS "Users can view their receptions" ON receptions;
CREATE POLICY "Users can view their receptions"
  ON receptions FOR SELECT
  USING (created_by = auth.uid() OR auth.uid() IN (
    SELECT user_id FROM user_profiles WHERE role = 'admin'
  ));

DROP POLICY IF EXISTS "Users can manage their receptions" ON receptions;
CREATE POLICY "Users can manage their receptions"
  ON receptions FOR ALL
  USING (created_by = auth.uid() OR auth.uid() IN (
    SELECT user_id FROM user_profiles WHERE role = 'admin'
  ));

-- Policies pour garanties
DROP POLICY IF EXISTS "Users can view their garanties" ON garanties;
CREATE POLICY "Users can view their garanties"
  ON garanties FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage their garanties" ON garanties;
CREATE POLICY "Users can manage their garanties"
  ON garanties FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM user_profiles WHERE role = 'admin'
  ) OR auth.uid() IS NOT NULL);

-- Policies pour desordres
DROP POLICY IF EXISTS "Users can view their desordres" ON desordres;
CREATE POLICY "Users can view their desordres"
  ON desordres FOR SELECT
  USING (created_by = auth.uid() OR auth.uid() IN (
    SELECT user_id FROM user_profiles WHERE role = 'admin'
  ));

DROP POLICY IF EXISTS "Users can manage their desordres" ON desordres;
CREATE POLICY "Users can manage their desordres"
  ON desordres FOR ALL
  USING (created_by = auth.uid() OR auth.uid() IN (
    SELECT user_id FROM user_profiles WHERE role = 'admin'
  ));

-- Policies pour doe
DROP POLICY IF EXISTS "Users can view DOE" ON doe;
CREATE POLICY "Users can view DOE"
  ON doe FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage DOE" ON doe;
CREATE POLICY "Users can manage DOE"
  ON doe FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Policies pour diuo
DROP POLICY IF EXISTS "Users can view DIUO" ON diuo;
CREATE POLICY "Users can view DIUO"
  ON diuo FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage DIUO" ON diuo;
CREATE POLICY "Users can manage DIUO"
  ON diuo FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Policies pour carnets_sante
DROP POLICY IF EXISTS "Users can view carnets sante" ON carnets_sante;
CREATE POLICY "Users can view carnets sante"
  ON carnets_sante FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage carnets sante" ON carnets_sante;
CREATE POLICY "Users can manage carnets sante"
  ON carnets_sante FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Policies pour retenues_garantie
DROP POLICY IF EXISTS "Users can view retenues garantie" ON retenues_garantie;
CREATE POLICY "Users can view retenues garantie"
  ON retenues_garantie FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage retenues garantie" ON retenues_garantie;
CREATE POLICY "Users can manage retenues garantie"
  ON retenues_garantie FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Policies pour visites_levee_reserves
DROP POLICY IF EXISTS "Users can view visites levee" ON visites_levee_reserves;
CREATE POLICY "Users can view visites levee"
  ON visites_levee_reserves FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage visites levee" ON visites_levee_reserves;
CREATE POLICY "Users can manage visites levee"
  ON visites_levee_reserves FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger function pour updated_at (si n'existe pas déjà)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour chaque table
DROP TRIGGER IF EXISTS update_opr_sessions_timestamp ON opr_sessions;
CREATE TRIGGER update_opr_sessions_timestamp
  BEFORE UPDATE ON opr_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reserves_timestamp ON reserves;
CREATE TRIGGER update_reserves_timestamp
  BEFORE UPDATE ON reserves
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_receptions_timestamp ON receptions;
CREATE TRIGGER update_receptions_timestamp
  BEFORE UPDATE ON receptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_garanties_timestamp ON garanties;
CREATE TRIGGER update_garanties_timestamp
  BEFORE UPDATE ON garanties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_desordres_timestamp ON desordres;
CREATE TRIGGER update_desordres_timestamp
  BEFORE UPDATE ON desordres
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_doe_timestamp ON doe;
CREATE TRIGGER update_doe_timestamp
  BEFORE UPDATE ON doe
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_diuo_timestamp ON diuo;
CREATE TRIGGER update_diuo_timestamp
  BEFORE UPDATE ON diuo
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_carnets_sante_timestamp ON carnets_sante;
CREATE TRIGGER update_carnets_sante_timestamp
  BEFORE UPDATE ON carnets_sante
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_retenues_garantie_timestamp ON retenues_garantie;
CREATE TRIGGER update_retenues_garantie_timestamp
  BEFORE UPDATE ON retenues_garantie
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_visites_levee_timestamp ON visites_levee_reserves;
CREATE TRIGGER update_visites_levee_timestamp
  BEFORE UPDATE ON visites_levee_reserves
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON TABLE opr_sessions IS 'Sessions d''Opérations Préalables à la Réception (OPR)';
COMMENT ON TABLE reserves IS 'Réserves émises lors des OPR et réceptions';
COMMENT ON TABLE receptions IS 'Procès-verbaux de réception des travaux';
COMMENT ON TABLE garanties IS 'Garanties légales associées aux réceptions';
COMMENT ON TABLE desordres IS 'Désordres et sinistres déclarés pendant les garanties';
COMMENT ON TABLE doe IS 'Dossiers des Ouvrages Exécutés (DOE)';
COMMENT ON TABLE diuo IS 'Dossiers d''Intervention Ultérieure sur l''Ouvrage (DIUO)';
COMMENT ON TABLE carnets_sante IS 'Carnets de santé du logement avec entretiens programmés';
COMMENT ON TABLE retenues_garantie IS 'Suivi des retenues de garantie et libérations';
COMMENT ON TABLE visites_levee_reserves IS 'Visites de levée des réserves';
