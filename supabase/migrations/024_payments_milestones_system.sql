-- =====================================================
-- Migration 024: Système de Paiements Jalonnés
-- Gestion des paiements, jalons, validation chantier et litiges
-- VERSION ROBUSTE avec gestion des états partiels
-- =====================================================

-- ===================
-- NETTOYAGE PRÉALABLE (si migration partielle précédente)
-- ===================

-- Supprimer les triggers existants pour éviter les conflits
DROP TRIGGER IF EXISTS update_contracts_timestamp ON project_contracts;
DROP TRIGGER IF EXISTS update_milestones_timestamp ON payment_milestones;
DROP TRIGGER IF EXISTS update_payments_timestamp ON payments;
DROP TRIGGER IF EXISTS update_disputes_timestamp ON disputes;

-- Supprimer les index existants pour les recréer proprement
DROP INDEX IF EXISTS idx_contracts_project;
DROP INDEX IF EXISTS idx_contracts_entreprise;
DROP INDEX IF EXISTS idx_contracts_client;
DROP INDEX IF EXISTS idx_contracts_status;
DROP INDEX IF EXISTS idx_milestones_contract;
DROP INDEX IF EXISTS idx_milestones_status;
DROP INDEX IF EXISTS idx_milestones_date_prevue;
DROP INDEX IF EXISTS idx_payments_contract;
DROP INDEX IF EXISTS idx_payments_milestone;
DROP INDEX IF EXISTS idx_payments_payer;
DROP INDEX IF EXISTS idx_payments_payee;
DROP INDEX IF EXISTS idx_payments_status;
DROP INDEX IF EXISTS idx_payments_stripe;
DROP INDEX IF EXISTS idx_payments_fraud_score;
DROP INDEX IF EXISTS idx_disputes_contract;
DROP INDEX IF EXISTS idx_disputes_status;
DROP INDEX IF EXISTS idx_disputes_opened_by;
DROP INDEX IF EXISTS idx_disputes_assigned;
DROP INDEX IF EXISTS idx_fraud_log_payment;
DROP INDEX IF EXISTS idx_fraud_log_contract;
DROP INDEX IF EXISTS idx_fraud_log_risk;
DROP INDEX IF EXISTS idx_enterprise_accounts_stripe;
DROP INDEX IF EXISTS idx_enterprise_accounts_status;
DROP INDEX IF EXISTS idx_transmissions_proposition;
DROP INDEX IF EXISTS idx_transmissions_entreprise;
DROP INDEX IF EXISTS idx_transmissions_status;
DROP INDEX IF EXISTS idx_liens_code;
DROP INDEX IF EXISTS idx_liens_proposition;

-- ===================
-- TYPES ÉNUMÉRÉS (avec gestion IF NOT EXISTS via DO block)
-- ===================

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pending', 'awaiting_payment', 'processing', 'held',
    'released', 'refunded', 'disputed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_type AS ENUM (
    'deposit', 'milestone', 'final', 'retention', 'penalty', 'adjustment'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE milestone_status AS ENUM (
    'pending', 'in_progress', 'submitted', 'validated', 'rejected', 'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dispute_status AS ENUM (
    'opened', 'under_review', 'mediation', 'resolved_client',
    'resolved_enterprise', 'escalated', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dispute_reason AS ENUM (
    'non_conformity', 'delay', 'quality', 'incomplete', 'price_dispute',
    'communication', 'damage', 'abandonment', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE fraud_risk_level AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===================
-- TABLE: Projets Contrats
-- ===================

CREATE TABLE IF NOT EXISTS project_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Références (phase0_projects peut ne pas exister, on rend optionnel)
  project_id UUID,
  proposition_id UUID,
  entreprise_id UUID NOT NULL,
  client_id UUID NOT NULL,

  -- Informations contrat
  reference VARCHAR(50) NOT NULL,
  titre VARCHAR(255) NOT NULL,
  description TEXT,

  -- Montants
  montant_total_ht DECIMAL(12,2) NOT NULL,
  montant_total_ttc DECIMAL(12,2) NOT NULL,
  taux_tva DECIMAL(5,2) DEFAULT 20.00,

  -- Dates
  date_signature TIMESTAMPTZ,
  date_debut_prevue DATE,
  date_fin_prevue DATE,
  date_debut_effective DATE,
  date_fin_effective DATE,

  -- Retenue de garantie
  retenue_garantie_pct DECIMAL(5,2) DEFAULT 5.00,
  retenue_garantie_duree_mois INTEGER DEFAULT 12,

  -- Pénalités de retard
  penalite_retard_jour DECIMAL(10,2) DEFAULT 0,
  penalite_plafond_pct DECIMAL(5,2) DEFAULT 5.00,

  -- Statut
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_signature', 'active', 'completed', 'terminated', 'disputed')),

  -- Documents
  documents JSONB DEFAULT '[]',

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,

  CONSTRAINT valid_montants CHECK (montant_total_ht > 0 AND montant_total_ttc >= montant_total_ht)
);

-- Ajouter contrainte UNIQUE sur reference si elle n'existe pas
DO $$ BEGIN
  ALTER TABLE project_contracts ADD CONSTRAINT project_contracts_reference_key UNIQUE (reference);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ajouter les FK si les tables référencées existent
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'phase0_projects' AND table_schema = 'public') THEN
    ALTER TABLE project_contracts
      ADD CONSTRAINT fk_contracts_project
      FOREIGN KEY (project_id) REFERENCES phase0_projects(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE project_contracts
    ADD CONSTRAINT fk_contracts_entreprise
    FOREIGN KEY (entreprise_id) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE project_contracts
    ADD CONSTRAINT fk_contracts_client
    FOREIGN KEY (client_id) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE project_contracts
    ADD CONSTRAINT fk_contracts_created_by
    FOREIGN KEY (created_by) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_contracts_project ON project_contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_entreprise ON project_contracts(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON project_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON project_contracts(status);

-- ===================
-- TABLE: Jalons de paiement
-- ===================

CREATE TABLE IF NOT EXISTS payment_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Références
  contract_id UUID NOT NULL,

  -- Identification
  numero INTEGER NOT NULL,
  designation VARCHAR(255) NOT NULL,
  description TEXT,

  -- Montants
  montant_ht DECIMAL(12,2) NOT NULL,
  montant_ttc DECIMAL(12,2) NOT NULL,
  pourcentage_contrat DECIMAL(5,2),

  -- Dates
  date_prevue DATE,
  date_soumission TIMESTAMPTZ,
  date_validation TIMESTAMPTZ,
  date_paiement TIMESTAMPTZ,

  -- Conditions de déclenchement
  conditions_declenchement TEXT[],
  livrables_attendus TEXT[],

  -- Validation
  status milestone_status DEFAULT 'pending',
  validated_by UUID,
  rejection_reason TEXT,

  -- Preuves fournies par l'entreprise
  preuves JSONB DEFAULT '[]',
  compte_rendu TEXT,

  -- Anti-arnaque: vérifications automatiques
  verification_auto JSONB DEFAULT '{}',
  fraud_check_result JSONB,
  fraud_risk_level fraud_risk_level DEFAULT 'low',

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter les FK
DO $$ BEGIN
  ALTER TABLE payment_milestones
    ADD CONSTRAINT fk_milestones_contract
    FOREIGN KEY (contract_id) REFERENCES project_contracts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payment_milestones
    ADD CONSTRAINT fk_milestones_validated_by
    FOREIGN KEY (validated_by) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Contrainte unique
DO $$ BEGIN
  ALTER TABLE payment_milestones ADD CONSTRAINT unique_milestone_numero UNIQUE (contract_id, numero);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_milestones_contract ON payment_milestones(contract_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON payment_milestones(status);
CREATE INDEX IF NOT EXISTS idx_milestones_date_prevue ON payment_milestones(date_prevue);

-- ===================
-- TABLE: Paiements
-- ===================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Références
  contract_id UUID NOT NULL,
  milestone_id UUID,

  -- Identification
  reference VARCHAR(50) NOT NULL,
  payment_type payment_type NOT NULL,

  -- Montants
  montant_ht DECIMAL(12,2) NOT NULL,
  montant_tva DECIMAL(12,2) NOT NULL,
  montant_ttc DECIMAL(12,2) NOT NULL,

  -- Stripe/Provider
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  stripe_transfer_id VARCHAR(255),
  provider_data JSONB DEFAULT '{}',

  -- Comptes
  payer_id UUID NOT NULL,
  payee_id UUID NOT NULL,

  -- Séquestre
  held_until TIMESTAMPTZ,
  escrow_released_at TIMESTAMPTZ,
  escrow_released_by UUID,

  -- Statut
  status payment_status DEFAULT 'pending',
  status_history JSONB DEFAULT '[]',

  -- Dates
  due_date DATE,
  paid_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,

  -- Vérifications anti-fraude
  fraud_checks JSONB DEFAULT '{}',
  fraud_score INTEGER DEFAULT 0,
  fraud_alerts TEXT[],
  requires_manual_review BOOLEAN DEFAULT FALSE,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_payment_montant CHECK (montant_ttc > 0)
);

-- Contrainte unique
DO $$ BEGIN
  ALTER TABLE payments ADD CONSTRAINT payments_reference_key UNIQUE (reference);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ajouter les FK
DO $$ BEGIN
  ALTER TABLE payments
    ADD CONSTRAINT fk_payments_contract
    FOREIGN KEY (contract_id) REFERENCES project_contracts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payments
    ADD CONSTRAINT fk_payments_milestone
    FOREIGN KEY (milestone_id) REFERENCES payment_milestones(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payments
    ADD CONSTRAINT fk_payments_payer
    FOREIGN KEY (payer_id) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payments
    ADD CONSTRAINT fk_payments_payee
    FOREIGN KEY (payee_id) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_payments_contract ON payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_payments_milestone ON payments(milestone_id);
CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payee ON payments(payee_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_stripe ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_fraud_score ON payments(fraud_score) WHERE fraud_score > 50;

-- ===================
-- TABLE: Litiges
-- ===================

CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Références
  contract_id UUID NOT NULL,
  payment_id UUID,
  milestone_id UUID,

  -- Identification
  reference VARCHAR(50) NOT NULL,

  -- Parties
  opened_by UUID NOT NULL,
  against UUID NOT NULL,

  -- Détails
  reason dispute_reason NOT NULL,
  titre VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  montant_conteste DECIMAL(12,2),

  -- Preuves
  preuves_demandeur JSONB DEFAULT '[]',
  preuves_defendeur JSONB DEFAULT '[]',

  -- Traitement
  status dispute_status DEFAULT 'opened',
  assigned_to UUID,

  -- Résolution
  resolution_type VARCHAR(50),
  resolution_description TEXT,
  resolution_montant DECIMAL(12,2),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,

  -- Timeline
  deadline_reponse TIMESTAMPTZ,
  deadline_resolution TIMESTAMPTZ,

  -- Historique
  historique JSONB DEFAULT '[]',

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contrainte unique
DO $$ BEGIN
  ALTER TABLE disputes ADD CONSTRAINT disputes_reference_key UNIQUE (reference);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ajouter les FK
DO $$ BEGIN
  ALTER TABLE disputes
    ADD CONSTRAINT fk_disputes_contract
    FOREIGN KEY (contract_id) REFERENCES project_contracts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE disputes
    ADD CONSTRAINT fk_disputes_payment
    FOREIGN KEY (payment_id) REFERENCES payments(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE disputes
    ADD CONSTRAINT fk_disputes_milestone
    FOREIGN KEY (milestone_id) REFERENCES payment_milestones(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_disputes_contract ON disputes(contract_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_opened_by ON disputes(opened_by);
CREATE INDEX IF NOT EXISTS idx_disputes_assigned ON disputes(assigned_to);

-- ===================
-- TABLE: Règles Anti-Fraude
-- ===================

CREATE TABLE IF NOT EXISTS fraud_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  code VARCHAR(50) NOT NULL,
  nom VARCHAR(255) NOT NULL,
  description TEXT,

  -- Configuration
  actif BOOLEAN DEFAULT TRUE,
  severite fraud_risk_level NOT NULL,
  score_impact INTEGER NOT NULL,

  -- Règle
  type_regle VARCHAR(50) NOT NULL,
  conditions JSONB NOT NULL,

  -- Actions
  action_auto VARCHAR(50),
  notification_admin BOOLEAN DEFAULT FALSE,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contrainte unique
DO $$ BEGIN
  ALTER TABLE fraud_rules ADD CONSTRAINT fraud_rules_code_key UNIQUE (code);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Insérer les règles anti-fraude par défaut (ON CONFLICT pour éviter les doublons)
INSERT INTO fraud_rules (code, nom, description, severite, score_impact, type_regle, conditions, action_auto, notification_admin) VALUES
('ACOMPTE_EXCESSIF', 'Acompte excessif', 'Acompte supérieur à 30% du montant total', 'high', 40, 'threshold',
 '{"field": "deposit_percentage", "operator": ">", "value": 30}', 'flag', TRUE),
('ACOMPTE_TRES_ELEVE', 'Acompte très élevé', 'Acompte supérieur à 50% du montant total', 'critical', 80, 'threshold',
 '{"field": "deposit_percentage", "operator": ">", "value": 50}', 'block', TRUE),
('PAIEMENT_PREMATURE', 'Demande de paiement prématurée', 'Demande de paiement avant la date prévue du jalon', 'medium', 25, 'timing',
 '{"type": "milestone_payment_before_date", "days_before": 7}', 'flag', FALSE),
('PAIEMENTS_RAPIDES', 'Paiements trop rapides', 'Plus de 2 demandes de paiement en moins de 7 jours', 'high', 35, 'pattern',
 '{"type": "payment_frequency", "max_count": 2, "days": 7}', 'hold', TRUE),
('MONTANT_INCOHERENT', 'Montant incohérent', 'Montant du jalon différent de plus de 20% du prévu', 'medium', 30, 'threshold',
 '{"field": "amount_variance", "operator": ">", "value": 20}', 'flag', TRUE),
('DEPASSEMENT_CONTRAT', 'Dépassement du contrat', 'Total des paiements dépasse le montant contractuel', 'critical', 100, 'threshold',
 '{"field": "total_vs_contract", "operator": ">", "value": 100}', 'block', TRUE),
('PREUVES_INSUFFISANTES', 'Preuves insuffisantes', 'Moins de 3 photos/documents pour un jalon > 5000€', 'medium', 20, 'threshold',
 '{"type": "proof_count", "min_proofs": 3, "amount_threshold": 5000}', 'flag', FALSE),
('PHOTOS_METADATA_MANQUANTES', 'Métadonnées photos absentes', 'Photos sans géolocalisation ou date EXIF', 'low', 10, 'pattern',
 '{"type": "photo_metadata", "required": ["geolocation", "date"]}', NULL, FALSE),
('NOUVELLE_ENTREPRISE', 'Nouvelle entreprise', 'Entreprise inscrite depuis moins de 30 jours', 'medium', 25, 'behavior',
 '{"type": "account_age", "days": 30}', 'flag', TRUE),
('PREMIER_PROJET', 'Premier projet de l''entreprise', 'Aucun projet complété précédemment', 'low', 15, 'behavior',
 '{"type": "completed_projects", "count": 0}', NULL, FALSE),
('LITIGE_RECENT', 'Litige récent', 'Litige dans les 90 derniers jours', 'high', 45, 'behavior',
 '{"type": "recent_dispute", "days": 90}', 'flag', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ===================
-- TABLE: Vérifications Anti-Fraude (Log)
-- ===================

CREATE TABLE IF NOT EXISTS fraud_checks_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Références
  payment_id UUID,
  milestone_id UUID,
  contract_id UUID,

  -- Résultat
  total_score INTEGER NOT NULL,
  risk_level fraud_risk_level NOT NULL,
  rules_triggered TEXT[],
  details JSONB NOT NULL,

  -- Actions
  action_taken VARCHAR(50),
  blocked BOOLEAN DEFAULT FALSE,
  requires_review BOOLEAN DEFAULT FALSE,

  -- Métadonnées
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter les FK
DO $$ BEGIN
  ALTER TABLE fraud_checks_log
    ADD CONSTRAINT fk_fraud_log_payment
    FOREIGN KEY (payment_id) REFERENCES payments(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE fraud_checks_log
    ADD CONSTRAINT fk_fraud_log_milestone
    FOREIGN KEY (milestone_id) REFERENCES payment_milestones(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE fraud_checks_log
    ADD CONSTRAINT fk_fraud_log_contract
    FOREIGN KEY (contract_id) REFERENCES project_contracts(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_fraud_log_payment ON fraud_checks_log(payment_id);
CREATE INDEX IF NOT EXISTS idx_fraud_log_contract ON fraud_checks_log(contract_id);
CREATE INDEX IF NOT EXISTS idx_fraud_log_risk ON fraud_checks_log(risk_level);

-- ===================
-- TABLE: Comptes entreprises (pour paiements)
-- ===================

CREATE TABLE IF NOT EXISTS enterprise_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Propriétaire
  user_id UUID NOT NULL,

  -- Stripe Connect
  stripe_account_id VARCHAR(255),
  stripe_account_status VARCHAR(50),
  stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
  stripe_charges_enabled BOOLEAN DEFAULT FALSE,
  stripe_payouts_enabled BOOLEAN DEFAULT FALSE,

  -- Informations bancaires (hashées/partielles)
  iban_last4 VARCHAR(4),
  bank_name VARCHAR(255),

  -- Vérification
  identity_verified BOOLEAN DEFAULT FALSE,
  business_verified BOOLEAN DEFAULT FALSE,

  -- Limites
  payout_limit_daily DECIMAL(12,2) DEFAULT 10000.00,
  payout_limit_monthly DECIMAL(12,2) DEFAULT 50000.00,

  -- Statistiques
  total_received DECIMAL(12,2) DEFAULT 0,
  total_pending DECIMAL(12,2) DEFAULT 0,
  total_disputes DECIMAL(12,2) DEFAULT 0,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contrainte unique sur user_id
DO $$ BEGIN
  ALTER TABLE enterprise_payment_accounts ADD CONSTRAINT enterprise_payment_accounts_user_id_key UNIQUE (user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE enterprise_payment_accounts
    ADD CONSTRAINT fk_enterprise_accounts_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_enterprise_accounts_stripe ON enterprise_payment_accounts(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_accounts_status ON enterprise_payment_accounts(stripe_account_status);

-- ===================
-- TABLE: Transmissions (pour TransmissionService)
-- ===================

CREATE TABLE IF NOT EXISTS transmissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Références
  proposition_id UUID NOT NULL,
  entreprise_id UUID NOT NULL,

  -- Client
  client JSONB NOT NULL,

  -- Canaux
  canaux JSONB DEFAULT '[]',

  -- Message
  message JSONB NOT NULL,

  -- Lien d'accès
  lien_acces JSONB NOT NULL,

  -- Tracking
  tracking JSONB DEFAULT '{}',

  -- Relances
  relances JSONB DEFAULT '[]',

  -- Statut
  status VARCHAR(50) DEFAULT 'envoye',

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE transmissions
    ADD CONSTRAINT fk_transmissions_entreprise
    FOREIGN KEY (entreprise_id) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_transmissions_proposition ON transmissions(proposition_id);
CREATE INDEX IF NOT EXISTS idx_transmissions_entreprise ON transmissions(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_transmissions_status ON transmissions(status);

-- ===================
-- TABLE: Liens d'accès
-- ===================

CREATE TABLE IF NOT EXISTS liens_acces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Références
  proposition_id UUID NOT NULL,

  -- Code
  code_acces VARCHAR(20) NOT NULL,

  -- Expiration
  expiration TIMESTAMPTZ NOT NULL,

  -- Consultations
  consultations INTEGER DEFAULT 0,
  derniere_consultation TIMESTAMPTZ,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contrainte unique
DO $$ BEGIN
  ALTER TABLE liens_acces ADD CONSTRAINT liens_acces_code_acces_key UNIQUE (code_acces);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_liens_code ON liens_acces(code_acces);
CREATE INDEX IF NOT EXISTS idx_liens_proposition ON liens_acces(proposition_id);

-- ===================
-- FONCTIONS
-- ===================

-- Fonction pour générer une référence unique
CREATE OR REPLACE FUNCTION generate_payment_reference(prefix VARCHAR DEFAULT 'PAY')
RETURNS VARCHAR AS $$
DECLARE
  v_date VARCHAR;
  v_random VARCHAR;
  v_ref VARCHAR;
BEGIN
  v_date := TO_CHAR(NOW(), 'YYYYMMDD');
  v_random := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
  v_ref := prefix || '-' || v_date || '-' || v_random;
  RETURN v_ref;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_payment_tables_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer les triggers
CREATE TRIGGER update_contracts_timestamp
  BEFORE UPDATE ON project_contracts
  FOR EACH ROW EXECUTE FUNCTION update_payment_tables_timestamp();

CREATE TRIGGER update_milestones_timestamp
  BEFORE UPDATE ON payment_milestones
  FOR EACH ROW EXECUTE FUNCTION update_payment_tables_timestamp();

CREATE TRIGGER update_payments_timestamp
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_payment_tables_timestamp();

CREATE TRIGGER update_disputes_timestamp
  BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION update_payment_tables_timestamp();

-- ===================
-- ROW LEVEL SECURITY
-- ===================

-- Activer RLS
ALTER TABLE project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_checks_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transmissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE liens_acces ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies existantes pour les recréer
DROP POLICY IF EXISTS contracts_select_own ON project_contracts;
DROP POLICY IF EXISTS contracts_insert_entreprise ON project_contracts;
DROP POLICY IF EXISTS contracts_update_parties ON project_contracts;
DROP POLICY IF EXISTS milestones_select_contract_parties ON payment_milestones;
DROP POLICY IF EXISTS milestones_insert_entreprise ON payment_milestones;
DROP POLICY IF EXISTS milestones_update_parties ON payment_milestones;
DROP POLICY IF EXISTS payments_select_own ON payments;
DROP POLICY IF EXISTS payments_insert_system ON payments;
DROP POLICY IF EXISTS disputes_select_parties ON disputes;
DROP POLICY IF EXISTS disputes_insert_auth ON disputes;
DROP POLICY IF EXISTS disputes_update_parties ON disputes;
DROP POLICY IF EXISTS payment_accounts_select_own ON enterprise_payment_accounts;
DROP POLICY IF EXISTS payment_accounts_insert_own ON enterprise_payment_accounts;
DROP POLICY IF EXISTS payment_accounts_update_own ON enterprise_payment_accounts;
DROP POLICY IF EXISTS transmissions_select_own ON transmissions;
DROP POLICY IF EXISTS transmissions_insert_own ON transmissions;
DROP POLICY IF EXISTS transmissions_update_own ON transmissions;
DROP POLICY IF EXISTS liens_select_all ON liens_acces;
DROP POLICY IF EXISTS fraud_log_admin_only ON fraud_checks_log;

-- Policies pour project_contracts
CREATE POLICY "contracts_select_own" ON project_contracts
  FOR SELECT USING (
    auth.uid() = client_id OR
    auth.uid() = entreprise_id OR
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'user_type' IN ('admin', 'super_admin'))
  );

CREATE POLICY "contracts_insert_entreprise" ON project_contracts
  FOR INSERT WITH CHECK (auth.uid() = entreprise_id);

CREATE POLICY "contracts_update_parties" ON project_contracts
  FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = entreprise_id);

-- Policies pour payment_milestones
CREATE POLICY "milestones_select_contract_parties" ON payment_milestones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_contracts
      WHERE id = payment_milestones.contract_id
        AND (client_id = auth.uid() OR entreprise_id = auth.uid())
    ) OR
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'user_type' IN ('admin', 'super_admin'))
  );

CREATE POLICY "milestones_insert_entreprise" ON payment_milestones
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_contracts
      WHERE id = payment_milestones.contract_id AND entreprise_id = auth.uid()
    )
  );

CREATE POLICY "milestones_update_parties" ON payment_milestones
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_contracts
      WHERE id = payment_milestones.contract_id
        AND (client_id = auth.uid() OR entreprise_id = auth.uid())
    )
  );

-- Policies pour payments
CREATE POLICY "payments_select_own" ON payments
  FOR SELECT USING (
    payer_id = auth.uid() OR
    payee_id = auth.uid() OR
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'user_type' IN ('admin', 'super_admin'))
  );

CREATE POLICY "payments_insert_system" ON payments
  FOR INSERT WITH CHECK (TRUE);

-- Policies pour disputes
CREATE POLICY "disputes_select_parties" ON disputes
  FOR SELECT USING (
    opened_by = auth.uid() OR
    against = auth.uid() OR
    assigned_to = auth.uid() OR
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'user_type' IN ('admin', 'super_admin'))
  );

CREATE POLICY "disputes_insert_auth" ON disputes
  FOR INSERT WITH CHECK (opened_by = auth.uid());

CREATE POLICY "disputes_update_parties" ON disputes
  FOR UPDATE USING (
    opened_by = auth.uid() OR
    against = auth.uid() OR
    assigned_to = auth.uid()
  );

-- Policies pour enterprise_payment_accounts
CREATE POLICY "payment_accounts_select_own" ON enterprise_payment_accounts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "payment_accounts_insert_own" ON enterprise_payment_accounts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "payment_accounts_update_own" ON enterprise_payment_accounts
  FOR UPDATE USING (user_id = auth.uid());

-- Policies pour transmissions
CREATE POLICY "transmissions_select_own" ON transmissions
  FOR SELECT USING (entreprise_id = auth.uid());

CREATE POLICY "transmissions_insert_own" ON transmissions
  FOR INSERT WITH CHECK (entreprise_id = auth.uid());

CREATE POLICY "transmissions_update_own" ON transmissions
  FOR UPDATE USING (entreprise_id = auth.uid());

-- Policies pour liens_acces (lecture publique pour consultation)
CREATE POLICY "liens_select_all" ON liens_acces
  FOR SELECT USING (TRUE);

-- Policies pour fraud_checks_log (admin only)
CREATE POLICY "fraud_log_admin_only" ON fraud_checks_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'user_type' IN ('admin', 'super_admin'))
  );

-- ===================
-- COMMENTAIRES
-- ===================

COMMENT ON TABLE project_contracts IS 'Contrats de projet liant client et entreprise';
COMMENT ON TABLE payment_milestones IS 'Jalons de paiement avec validation et preuves';
COMMENT ON TABLE payments IS 'Paiements avec séquestre et vérification anti-fraude';
COMMENT ON TABLE disputes IS 'Litiges entre parties avec médiation TORP';
COMMENT ON TABLE fraud_rules IS 'Règles configurables de détection de fraude';
COMMENT ON TABLE fraud_checks_log IS 'Historique des vérifications anti-fraude';
COMMENT ON TABLE enterprise_payment_accounts IS 'Comptes Stripe Connect des entreprises';

COMMENT ON FUNCTION generate_payment_reference IS 'Génère une référence unique pour les paiements';
