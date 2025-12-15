-- Migration: create_phase3_tables.sql
-- Tables Phase 3 (Ex??cution) pour remplacer les donn??es mock??es

-- ============================================
-- Table contr??les qualit??
-- ============================================
CREATE TABLE IF NOT EXISTS public.quality_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  lot_id UUID,

  -- Type de contr??le
  control_type VARCHAR(50) NOT NULL, -- autocontrole, bureau_controle, moe, reception
  control_category VARCHAR(50), -- gros_oeuvre, electricite, plomberie, etc.

  -- Checkpoint
  checkpoint_id VARCHAR(50) NOT NULL,
  checkpoint_label TEXT NOT NULL,

  -- R??sultat
  status VARCHAR(20) DEFAULT 'pending', -- pending, pass, fail, na
  value JSONB, -- Valeur mesur??e si applicable

  -- D??tails
  notes TEXT,
  photos JSONB DEFAULT '[]',

  -- M??tadonn??es
  controlled_at TIMESTAMPTZ,
  controlled_by UUID,
  company_id UUID, -- Entreprise concern??e pour autocontr??les

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quality_controls_project ON public.quality_controls(project_id);
CREATE INDEX IF NOT EXISTS idx_quality_controls_lot ON public.quality_controls(lot_id);
CREATE INDEX IF NOT EXISTS idx_quality_controls_status ON public.quality_controls(status);

-- ============================================
-- Table visites de contr??le
-- ============================================
CREATE TABLE IF NOT EXISTS public.control_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,

  -- Type
  visit_type VARCHAR(50) NOT NULL, -- bureau_controle, interne, organisme, sps
  organisme_name VARCHAR(255),
  organisme_id UUID,

  -- Planning
  scheduled_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_minutes INT,

  -- Participants
  participants JSONB DEFAULT '[]', -- [{name, role, company, email}]

  -- R??sultat
  status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled, reported
  report_reference VARCHAR(100),
  report_path VARCHAR(255),
  observations JSONB DEFAULT '[]', -- [{type, description, severity, location, photo_url}]

  -- R??serves ??mises
  reserves_count INT DEFAULT 0,
  reserves_levees_count INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_control_visits_project ON public.control_visits(project_id);
CREATE INDEX IF NOT EXISTS idx_control_visits_scheduled ON public.control_visits(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_control_visits_status ON public.control_visits(status);

-- ============================================
-- Table cr??neaux de coordination
-- ============================================
CREATE TABLE IF NOT EXISTS public.coordination_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,

  -- Cr??neau
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- Entreprise
  company_id UUID,
  company_name VARCHAR(255) NOT NULL,
  lot_code VARCHAR(20),

  -- Zone
  zone_id VARCHAR(50),
  zone_name VARCHAR(100),

  -- Statut
  status VARCHAR(20) DEFAULT 'planifie', -- planifie, confirme, en_cours, termine, annule

  -- Notes
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coordination_slots_project ON public.coordination_slots(project_id);
CREATE INDEX IF NOT EXISTS idx_coordination_slots_date ON public.coordination_slots(slot_date);
CREATE INDEX IF NOT EXISTS idx_coordination_slots_company ON public.coordination_slots(company_id);

-- ============================================
-- Table conflits de coordination
-- ============================================
CREATE TABLE IF NOT EXISTS public.coordination_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,

  -- Cr??neaux en conflit
  slot_id_1 UUID REFERENCES public.coordination_slots(id) ON DELETE CASCADE,
  slot_id_2 UUID REFERENCES public.coordination_slots(id) ON DELETE CASCADE,

  -- Type de conflit
  conflict_type VARCHAR(50) NOT NULL, -- chevauchement_zone, chevauchement_temps, dependance, ressource
  severity VARCHAR(20) DEFAULT 'warning', -- info, warning, error

  -- Description
  description TEXT,

  -- R??solution
  status VARCHAR(20) DEFAULT 'open', -- open, acknowledged, resolved, ignored
  resolution TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coordination_conflicts_project ON public.coordination_conflicts(project_id);
CREATE INDEX IF NOT EXISTS idx_coordination_conflicts_status ON public.coordination_conflicts(status);

-- ============================================
-- Table carnet de liaison
-- ============================================
CREATE TABLE IF NOT EXISTS public.correspondence_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  company_id UUID,

  -- Message
  message_type VARCHAR(30) NOT NULL, -- question, response, instruction, alert, info
  subject TEXT,
  content TEXT NOT NULL,

  -- Pi??ces jointes
  attachments JSONB DEFAULT '[]', -- [{name, path, type, size}]

  -- ??metteur
  sender_id UUID,
  sender_name VARCHAR(255),
  sender_role VARCHAR(50), -- moe, mo, entreprise, coordinateur
  sender_company VARCHAR(255),

  -- Destinataires
  recipients JSONB DEFAULT '[]', -- [{id, name, role}]

  -- Lecture
  read_by JSONB DEFAULT '[]', -- [{user_id, read_at}]

  -- R??f??rence
  parent_id UUID REFERENCES public.correspondence_logs(id),
  thread_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correspondence_project ON public.correspondence_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_correspondence_company ON public.correspondence_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_correspondence_thread ON public.correspondence_logs(thread_id);

-- ============================================
-- Table situations de travaux
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_situations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,

  -- Num??ro
  numero INT NOT NULL,
  reference VARCHAR(50),

  -- P??riode
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Avancement par lot
  lots_progress JSONB NOT NULL, -- [{lot_id, lot_code, contract_amount, progress_pct, cumulative_amount, previous_amount, current_amount}]

  -- Montants cumul??s
  cumulative_amount_ht DECIMAL(15,2),
  previous_amount_ht DECIMAL(15,2),
  current_amount_ht DECIMAL(15,2),

  -- Retenue de garantie
  retention_rate DECIMAL(5,2) DEFAULT 5.00,
  retention_amount DECIMAL(15,2),

  -- TVA
  tva_rate DECIMAL(5,2) DEFAULT 10.00,
  tva_amount DECIMAL(15,2),

  -- Total
  net_to_pay DECIMAL(15,2),

  -- Statut
  status VARCHAR(20) DEFAULT 'draft', -- draft, submitted, validated, contested, paid
  submitted_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  validated_by UUID,
  paid_at TIMESTAMPTZ,

  -- Document
  document_path VARCHAR(255),

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_situations_project ON public.payment_situations(project_id);
CREATE INDEX IF NOT EXISTS idx_situations_status ON public.payment_situations(status);

-- ============================================
-- Table avenants
-- ============================================
CREATE TABLE IF NOT EXISTS public.contract_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,

  -- Num??ro
  numero INT NOT NULL,
  reference VARCHAR(50),

  -- Type
  amendment_type VARCHAR(30) NOT NULL, -- travaux_supplementaires, moins_value, modification_delai, modification_prix, autre

  -- Description
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  justification TEXT,

  -- Impact financier
  amount_ht DECIMAL(15,2),
  is_increase BOOLEAN DEFAULT true,

  -- Impact d??lai
  delay_impact_days INT DEFAULT 0,
  new_end_date DATE,

  -- Lots concern??s
  lot_ids UUID[] DEFAULT '{}',

  -- Statut
  status VARCHAR(20) DEFAULT 'draft', -- draft, pending_moe, pending_mo, approved, rejected, signed

  -- Workflow
  submitted_at TIMESTAMPTZ,
  moe_approved_at TIMESTAMPTZ,
  moe_approved_by UUID,
  mo_approved_at TIMESTAMPTZ,
  mo_approved_by UUID,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID,
  rejection_reason TEXT,

  -- Document
  document_path VARCHAR(255),
  signed_document_path VARCHAR(255),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_amendments_project ON public.contract_amendments(project_id);
CREATE INDEX IF NOT EXISTS idx_amendments_status ON public.contract_amendments(status);

-- ============================================
-- Table journal de chantier
-- ============================================
CREATE TABLE IF NOT EXISTS public.site_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,

  -- Date
  journal_date DATE NOT NULL,

  -- M??t??o
  weather VARCHAR(30), -- ensoleille, nuageux, pluie, neige, gel, vent_fort
  temperature_min INT,
  temperature_max INT,
  weather_impact BOOLEAN DEFAULT false,
  weather_notes TEXT,

  -- Pr??sences
  personnel_on_site JSONB DEFAULT '[]', -- [{company_id, company_name, workers_count, hours_worked, arrival_time, departure_time}]
  total_workers INT,
  total_hours DECIMAL(8,1),

  -- Travaux r??alis??s
  works_completed JSONB DEFAULT '[]', -- [{lot_code, description, quantity, unit, location}]

  -- Livraisons
  deliveries JSONB DEFAULT '[]', -- [{supplier, material, quantity, conformity, notes}]

  -- Incidents
  incidents JSONB DEFAULT '[]', -- [{type, severity, description, actions_taken, persons_involved}]

  -- S??curit??
  safety_checks JSONB DEFAULT '{}', -- {epi_ok, zone_balisee, extincteurs_ok, etc.}

  -- Notes g??n??rales
  notes TEXT,

  -- Photos
  photos JSONB DEFAULT '[]', -- [{path, caption, category, timestamp}]

  -- Auteur
  logged_by UUID,
  logged_by_name VARCHAR(255),

  -- Validation
  validated_at TIMESTAMPTZ,
  validated_by UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, journal_date)
);

CREATE INDEX IF NOT EXISTS idx_journal_project ON public.site_journal(project_id);
CREATE INDEX IF NOT EXISTS idx_journal_date ON public.site_journal(journal_date DESC);

-- ============================================
-- Triggers updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_phase3_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger ?? toutes les tables Phase 3
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'quality_controls', 'control_visits', 'coordination_slots',
      'payment_situations', 'contract_amendments', 'site_journal'
    ])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trigger_%I_updated_at ON public.%I;
      CREATE TRIGGER trigger_%I_updated_at
        BEFORE UPDATE ON public.%I
        FOR EACH ROW
        EXECUTE FUNCTION update_phase3_updated_at();
    ', t, t, t, t);
  END LOOP;
END $$;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE public.quality_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coordination_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coordination_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correspondence_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_situations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_journal ENABLE ROW LEVEL SECURITY;

-- Politique simple: utilisateurs authentifi??s ont acc??s complet
-- (En production, affiner selon les r??les et les projets de l'utilisateur)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'quality_controls', 'control_visits', 'coordination_slots',
      'coordination_conflicts', 'correspondence_logs',
      'payment_situations', 'contract_amendments', 'site_journal'
    ])
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "Authenticated access %I" ON public.%I;
      CREATE POLICY "Authenticated access %I"
        ON public.%I FOR ALL TO authenticated
        USING (true) WITH CHECK (true);
    ', t, t, t, t);
  END LOOP;
END $$;

-- ============================================
-- Commentaires
-- ============================================
COMMENT ON TABLE public.quality_controls IS 'Contr??les qualit?? Phase 3 - autocontr??les, visites, etc.';
COMMENT ON TABLE public.control_visits IS 'Visites de contr??le planifi??es et r??alis??es';
COMMENT ON TABLE public.coordination_slots IS 'Cr??neaux de coordination inter-entreprises';
COMMENT ON TABLE public.coordination_conflicts IS 'Conflits de planning d??tect??s';
COMMENT ON TABLE public.correspondence_logs IS 'Carnet de liaison / correspondance chantier';
COMMENT ON TABLE public.payment_situations IS 'Situations de travaux pour paiement';
COMMENT ON TABLE public.contract_amendments IS 'Avenants au march??';
COMMENT ON TABLE public.site_journal IS 'Journal quotidien de chantier';
