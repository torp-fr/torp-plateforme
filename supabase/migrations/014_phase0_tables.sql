-- TORP Phase 0 Database Schema
-- Migration for Phase 0 (Conception & Définition)

-- =====================================================
-- ENUMS FOR PHASE 0
-- =====================================================

CREATE TYPE phase0_status AS ENUM (
  'draft',
  'in_progress',
  'awaiting_validation',
  'validated',
  'consultation_ready',
  'in_consultation',
  'quotes_received',
  'archived'
);

CREATE TYPE wizard_mode AS ENUM (
  'b2c_simple',
  'b2c_detailed',
  'b2b_professional',
  'b2g_public'
);

CREATE TYPE owner_type AS ENUM ('B2C', 'B2B', 'B2G');

CREATE TYPE lot_category AS ENUM (
  'gros_oeuvre',
  'enveloppe',
  'cloisonnement',
  'finitions',
  'electricite',
  'plomberie',
  'cvc',
  'ventilation',
  'exterieurs',
  'speciaux'
);

CREATE TYPE deduction_status AS ENUM (
  'pending',
  'executing',
  'success',
  'partial',
  'failed',
  'skipped',
  'expired'
);

CREATE TYPE document_generation_status AS ENUM (
  'pending',
  'generating',
  'ready',
  'failed',
  'expired'
);

-- =====================================================
-- PHASE 0 PROJECTS TABLE
-- =====================================================

CREATE TABLE public.phase0_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Project identification
  name TEXT NOT NULL DEFAULT 'Nouveau projet',
  reference_number TEXT UNIQUE,

  -- Core data (stored as JSONB for flexibility)
  owner_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  property JSONB NOT NULL DEFAULT '{}'::jsonb,
  work_project JSONB NOT NULL DEFAULT '{}'::jsonb,
  selected_lots JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Status and progress
  status phase0_status NOT NULL DEFAULT 'draft',
  wizard_mode wizard_mode NOT NULL DEFAULT 'b2c_simple',
  completeness DECIMAL(5,2) DEFAULT 0 CHECK (completeness >= 0 AND completeness <= 100),

  -- Validation
  is_validated BOOLEAN DEFAULT FALSE,
  validated_at TIMESTAMP WITH TIME ZONE,
  validated_by UUID REFERENCES public.users(id),
  validation_method TEXT,
  validation_score JSONB,

  -- Wizard state
  wizard_state JSONB DEFAULT '{}'::jsonb,
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER DEFAULT 6,

  -- AI deductions
  deductions JSONB DEFAULT '[]'::jsonb,
  deductions_applied_count INTEGER DEFAULT 0,

  -- Alerts
  alerts JSONB DEFAULT '[]'::jsonb,

  -- Budget summary (denormalized for quick access)
  estimated_budget_min DECIMAL(15,2),
  estimated_budget_max DECIMAL(15,2),
  estimated_budget_target DECIMAL(15,2),
  currency TEXT DEFAULT 'EUR',

  -- Timeline summary
  target_start_date DATE,
  target_end_date DATE,
  estimated_duration_days INTEGER,

  -- Property summary (denormalized)
  property_type TEXT,
  property_address TEXT,
  property_city TEXT,
  property_postal_code TEXT,
  property_surface DECIMAL(10,2),

  -- Lots summary
  selected_lots_count INTEGER DEFAULT 0,
  rge_lots_count INTEGER DEFAULT 0,
  aids_eligible_amount DECIMAL(15,2),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for phase0_projects
CREATE INDEX idx_phase0_projects_user_id ON public.phase0_projects(user_id);
CREATE INDEX idx_phase0_projects_status ON public.phase0_projects(status);
CREATE INDEX idx_phase0_projects_wizard_mode ON public.phase0_projects(wizard_mode);
CREATE INDEX idx_phase0_projects_created_at ON public.phase0_projects(created_at DESC);
CREATE INDEX idx_phase0_projects_completeness ON public.phase0_projects(completeness DESC);
CREATE INDEX idx_phase0_projects_property_city ON public.phase0_projects(property_city);
CREATE INDEX idx_phase0_projects_property_postal ON public.phase0_projects(property_postal_code);

-- GIN index for JSONB searches
CREATE INDEX idx_phase0_projects_owner_profile ON public.phase0_projects USING GIN (owner_profile);
CREATE INDEX idx_phase0_projects_property ON public.phase0_projects USING GIN (property);
CREATE INDEX idx_phase0_projects_work_project ON public.phase0_projects USING GIN (work_project);
CREATE INDEX idx_phase0_projects_tags ON public.phase0_projects USING GIN (tags);

-- =====================================================
-- WIZARD PROGRESS TABLE (separate for better tracking)
-- =====================================================

CREATE TABLE public.phase0_wizard_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.phase0_projects(id) ON DELETE CASCADE,

  -- Current progress
  current_step INTEGER NOT NULL DEFAULT 1,
  total_steps INTEGER NOT NULL DEFAULT 6,

  -- Step data (answers by step)
  step_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  step_completion JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- AI deductions pending user action
  pending_deductions JSONB DEFAULT '[]'::jsonb,

  -- Validation errors
  validation_errors JSONB DEFAULT '[]'::jsonb,

  -- Session tracking
  session_id TEXT,
  session_started_at TIMESTAMP WITH TIME ZONE,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_time_spent INTEGER DEFAULT 0, -- in seconds

  -- Device info
  device_type TEXT,
  browser TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_project_wizard UNIQUE (project_id)
);

CREATE INDEX idx_phase0_wizard_project_id ON public.phase0_wizard_progress(project_id);
CREATE INDEX idx_phase0_wizard_last_active ON public.phase0_wizard_progress(last_active_at DESC);

-- =====================================================
-- SELECTED LOTS TABLE (denormalized for queries)
-- =====================================================

CREATE TABLE public.phase0_selected_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.phase0_projects(id) ON DELETE CASCADE,

  -- Lot identification
  lot_type TEXT NOT NULL,
  lot_number TEXT NOT NULL,
  lot_name TEXT NOT NULL,
  category lot_category NOT NULL,

  -- Selection info
  is_selected BOOLEAN DEFAULT TRUE,
  is_mandatory BOOLEAN DEFAULT FALSE,
  is_suggested BOOLEAN DEFAULT FALSE,
  suggestion_reason TEXT,

  -- Lot data
  qualification_responses JSONB DEFAULT '{}'::jsonb,
  data_schema JSONB DEFAULT '{}'::jsonb,
  options JSONB DEFAULT '[]'::jsonb,

  -- Estimation
  estimated_price_min DECIMAL(15,2),
  estimated_price_max DECIMAL(15,2),
  estimated_price_average DECIMAL(15,2),
  estimation_confidence TEXT DEFAULT 'medium',

  -- Duration
  estimated_duration_min INTEGER, -- days
  estimated_duration_max INTEGER,

  -- RGE & Aides
  rge_eligible BOOLEAN DEFAULT FALSE,
  eligible_aids TEXT[] DEFAULT ARRAY[]::TEXT[],
  estimated_aids_amount DECIMAL(15,2),

  -- Regulations
  applicable_dtus TEXT[] DEFAULT ARRAY[]::TEXT[],
  regulations JSONB DEFAULT '[]'::jsonb,

  -- Ordering
  display_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_project_lot UNIQUE (project_id, lot_type)
);

CREATE INDEX idx_phase0_lots_project_id ON public.phase0_selected_lots(project_id);
CREATE INDEX idx_phase0_lots_category ON public.phase0_selected_lots(category);
CREATE INDEX idx_phase0_lots_lot_type ON public.phase0_selected_lots(lot_type);
CREATE INDEX idx_phase0_lots_rge ON public.phase0_selected_lots(rge_eligible);

-- =====================================================
-- DEDUCTIONS HISTORY TABLE
-- =====================================================

CREATE TABLE public.phase0_deductions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.phase0_projects(id) ON DELETE CASCADE,

  -- Rule info
  rule_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  category TEXT NOT NULL,

  -- Execution
  status deduction_status NOT NULL DEFAULT 'pending',
  executed_at TIMESTAMP WITH TIME ZONE,
  execution_time_ms INTEGER,

  -- Source and target
  source_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_fields TEXT[] DEFAULT ARRAY[]::TEXT[],
  target_field TEXT NOT NULL,

  -- Result
  deduced_value JSONB,
  previous_value JSONB,
  confidence TEXT DEFAULT 'medium',
  reasoning TEXT,

  -- User action
  user_action TEXT, -- 'accepted', 'rejected', 'modified', 'pending'
  user_action_at TIMESTAMP WITH TIME ZONE,
  user_override_value JSONB,

  -- Error info
  error_code TEXT,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_phase0_deductions_project_id ON public.phase0_deductions(project_id);
CREATE INDEX idx_phase0_deductions_rule_id ON public.phase0_deductions(rule_id);
CREATE INDEX idx_phase0_deductions_status ON public.phase0_deductions(status);
CREATE INDEX idx_phase0_deductions_created_at ON public.phase0_deductions(created_at DESC);

-- =====================================================
-- GENERATED DOCUMENTS TABLE
-- =====================================================

CREATE TABLE public.phase0_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.phase0_projects(id) ON DELETE CASCADE,

  -- Document info
  document_type TEXT NOT NULL, -- 'ccf', 'aps', 'cctp', 'dpgf', etc.
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER DEFAULT 1,
  format TEXT NOT NULL DEFAULT 'pdf', -- 'pdf', 'docx', 'xlsx', 'html'

  -- Status
  status document_generation_status DEFAULT 'pending',
  generated_at TIMESTAMP WITH TIME ZONE,
  generation_time_ms INTEGER,

  -- File storage
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_hash TEXT, -- for integrity check

  -- Validity
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Template info
  template_id TEXT,
  template_version TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  sections TEXT[] DEFAULT ARRAY[]::TEXT[],
  page_count INTEGER,

  -- Error info
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_phase0_documents_project_id ON public.phase0_documents(project_id);
CREATE INDEX idx_phase0_documents_type ON public.phase0_documents(document_type);
CREATE INDEX idx_phase0_documents_status ON public.phase0_documents(status);
CREATE INDEX idx_phase0_documents_created_at ON public.phase0_documents(created_at DESC);

-- =====================================================
-- EXTERNAL API CACHE TABLE
-- =====================================================

CREATE TABLE public.phase0_api_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Cache key
  api_id TEXT NOT NULL, -- 'api_ban', 'api_georisques', etc.
  cache_key TEXT NOT NULL, -- Hash of request params

  -- Request info
  request_params JSONB NOT NULL,
  endpoint TEXT,

  -- Response
  response_data JSONB NOT NULL,
  response_status INTEGER,

  -- Validity
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT unique_api_cache_key UNIQUE (api_id, cache_key)
);

CREATE INDEX idx_phase0_api_cache_key ON public.phase0_api_cache(api_id, cache_key);
CREATE INDEX idx_phase0_api_cache_expires ON public.phase0_api_cache(expires_at);

-- =====================================================
-- LOT REFERENCE DATA TABLE
-- =====================================================

CREATE TABLE public.phase0_lot_reference (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Lot identification
  lot_type TEXT UNIQUE NOT NULL,
  lot_number TEXT NOT NULL,
  lot_name TEXT NOT NULL,
  category lot_category NOT NULL,

  -- Description
  description TEXT NOT NULL,
  common_works TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Regulations
  required_dtus TEXT[] DEFAULT ARRAY[]::TEXT[],
  required_certifications TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Dependencies
  dependencies TEXT[] DEFAULT ARRAY[]::TEXT[],
  incompatibilities TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Pricing (reference)
  price_min DECIMAL(10,2),
  price_max DECIMAL(10,2),
  price_unit TEXT DEFAULT 'euro_m2',
  price_region TEXT DEFAULT 'France',
  price_year INTEGER DEFAULT 2024,

  -- Duration
  duration_min_days INTEGER,
  duration_max_days INTEGER,
  duration_factors TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Complexity
  complexity_level TEXT DEFAULT 'moderate',

  -- Eligibility
  rge_eligible BOOLEAN DEFAULT FALSE,
  eligible_aids TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Qualification questions
  qualification_questions JSONB DEFAULT '[]'::jsonb,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_phase0_lot_ref_type ON public.phase0_lot_reference(lot_type);
CREATE INDEX idx_phase0_lot_ref_category ON public.phase0_lot_reference(category);
CREATE INDEX idx_phase0_lot_ref_rge ON public.phase0_lot_reference(rge_eligible);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamps
CREATE TRIGGER update_phase0_projects_updated_at
  BEFORE UPDATE ON public.phase0_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phase0_wizard_updated_at
  BEFORE UPDATE ON public.phase0_wizard_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phase0_lots_updated_at
  BEFORE UPDATE ON public.phase0_selected_lots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phase0_deductions_updated_at
  BEFORE UPDATE ON public.phase0_deductions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phase0_documents_updated_at
  BEFORE UPDATE ON public.phase0_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phase0_lot_ref_updated_at
  BEFORE UPDATE ON public.phase0_lot_reference
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Generate unique reference number
CREATE OR REPLACE FUNCTION generate_phase0_reference()
RETURNS TEXT AS $$
DECLARE
  year_prefix TEXT;
  sequence_num INTEGER;
  ref_number TEXT;
BEGIN
  year_prefix := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference_number FROM 6) AS INTEGER)
  ), 0) + 1
  INTO sequence_num
  FROM public.phase0_projects
  WHERE reference_number LIKE year_prefix || '-%';

  ref_number := year_prefix || '-' || LPAD(sequence_num::TEXT, 5, '0');

  RETURN ref_number;
END;
$$ LANGUAGE plpgsql;

-- Auto-generate reference on insert
CREATE OR REPLACE FUNCTION set_phase0_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference_number IS NULL THEN
    NEW.reference_number := generate_phase0_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_phase0_project_reference
  BEFORE INSERT ON public.phase0_projects
  FOR EACH ROW EXECUTE FUNCTION set_phase0_reference();

-- Calculate completeness
CREATE OR REPLACE FUNCTION calculate_phase0_completeness(project_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  total_weight DECIMAL := 0;
  completed_weight DECIMAL := 0;
  owner_weight DECIMAL := 15;
  property_weight DECIMAL := 25;
  lots_weight DECIMAL := 30;
  constraints_weight DECIMAL := 10;
  budget_weight DECIMAL := 15;
  validation_weight DECIMAL := 5;
  p RECORD;
BEGIN
  SELECT * INTO p FROM public.phase0_projects WHERE id = project_id;

  IF p IS NULL THEN
    RETURN 0;
  END IF;

  total_weight := owner_weight + property_weight + lots_weight + constraints_weight + budget_weight + validation_weight;

  -- Check owner profile completeness
  IF p.owner_profile ? 'identity' AND p.owner_profile->'identity' ? 'type' THEN
    completed_weight := completed_weight + (owner_weight * 0.5);
    IF p.owner_profile ? 'contact' THEN
      completed_weight := completed_weight + (owner_weight * 0.5);
    END IF;
  END IF;

  -- Check property completeness
  IF p.property ? 'identification' AND p.property->'identification' ? 'address' THEN
    completed_weight := completed_weight + (property_weight * 0.4);
    IF p.property ? 'characteristics' THEN
      completed_weight := completed_weight + (property_weight * 0.3);
    END IF;
    IF p.property ? 'currentCondition' THEN
      completed_weight := completed_weight + (property_weight * 0.3);
    END IF;
  END IF;

  -- Check lots selection
  IF p.selected_lots_count > 0 THEN
    completed_weight := completed_weight + lots_weight;
  END IF;

  -- Check constraints
  IF p.work_project ? 'constraints' THEN
    completed_weight := completed_weight + constraints_weight;
  END IF;

  -- Check budget
  IF p.estimated_budget_target IS NOT NULL AND p.estimated_budget_target > 0 THEN
    completed_weight := completed_weight + budget_weight;
  END IF;

  -- Check validation
  IF p.is_validated THEN
    completed_weight := completed_weight + validation_weight;
  END IF;

  RETURN ROUND((completed_weight / total_weight) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Update lots count on phase0_selected_lots changes
CREATE OR REPLACE FUNCTION update_phase0_lots_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.phase0_projects
    SET
      selected_lots_count = (
        SELECT COUNT(*) FROM public.phase0_selected_lots
        WHERE project_id = NEW.project_id AND is_selected = TRUE
      ),
      rge_lots_count = (
        SELECT COUNT(*) FROM public.phase0_selected_lots
        WHERE project_id = NEW.project_id AND is_selected = TRUE AND rge_eligible = TRUE
      ),
      updated_at = NOW()
    WHERE id = NEW.project_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.phase0_projects
    SET
      selected_lots_count = (
        SELECT COUNT(*) FROM public.phase0_selected_lots
        WHERE project_id = OLD.project_id AND is_selected = TRUE
      ),
      rge_lots_count = (
        SELECT COUNT(*) FROM public.phase0_selected_lots
        WHERE project_id = OLD.project_id AND is_selected = TRUE AND rge_eligible = TRUE
      ),
      updated_at = NOW()
    WHERE id = OLD.project_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lots_count_on_insert
  AFTER INSERT ON public.phase0_selected_lots
  FOR EACH ROW EXECUTE FUNCTION update_phase0_lots_count();

CREATE TRIGGER update_lots_count_on_update
  AFTER UPDATE ON public.phase0_selected_lots
  FOR EACH ROW EXECUTE FUNCTION update_phase0_lots_count();

CREATE TRIGGER update_lots_count_on_delete
  AFTER DELETE ON public.phase0_selected_lots
  FOR EACH ROW EXECUTE FUNCTION update_phase0_lots_count();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.phase0_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase0_wizard_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase0_selected_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase0_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase0_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase0_api_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase0_lot_reference ENABLE ROW LEVEL SECURITY;

-- Phase0 projects policies
CREATE POLICY "Users can view their own phase0 projects"
  ON public.phase0_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own phase0 projects"
  ON public.phase0_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own phase0 projects"
  ON public.phase0_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own phase0 projects"
  ON public.phase0_projects FOR DELETE
  USING (auth.uid() = user_id);

-- Wizard progress policies
CREATE POLICY "Users can view wizard progress for their projects"
  ON public.phase0_wizard_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.phase0_projects
      WHERE phase0_projects.id = phase0_wizard_progress.project_id
      AND phase0_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage wizard progress for their projects"
  ON public.phase0_wizard_progress FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.phase0_projects
      WHERE phase0_projects.id = phase0_wizard_progress.project_id
      AND phase0_projects.user_id = auth.uid()
    )
  );

-- Selected lots policies
CREATE POLICY "Users can view lots for their projects"
  ON public.phase0_selected_lots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.phase0_projects
      WHERE phase0_projects.id = phase0_selected_lots.project_id
      AND phase0_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage lots for their projects"
  ON public.phase0_selected_lots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.phase0_projects
      WHERE phase0_projects.id = phase0_selected_lots.project_id
      AND phase0_projects.user_id = auth.uid()
    )
  );

-- Deductions policies
CREATE POLICY "Users can view deductions for their projects"
  ON public.phase0_deductions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.phase0_projects
      WHERE phase0_projects.id = phase0_deductions.project_id
      AND phase0_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage deductions for their projects"
  ON public.phase0_deductions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.phase0_projects
      WHERE phase0_projects.id = phase0_deductions.project_id
      AND phase0_projects.user_id = auth.uid()
    )
  );

-- Documents policies
CREATE POLICY "Users can view documents for their projects"
  ON public.phase0_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.phase0_projects
      WHERE phase0_projects.id = phase0_documents.project_id
      AND phase0_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage documents for their projects"
  ON public.phase0_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.phase0_projects
      WHERE phase0_projects.id = phase0_documents.project_id
      AND phase0_projects.user_id = auth.uid()
    )
  );

-- API cache is accessible by all authenticated users (read only)
CREATE POLICY "Authenticated users can read API cache"
  ON public.phase0_api_cache FOR SELECT
  TO authenticated
  USING (true);

-- Lot reference is public read
CREATE POLICY "Anyone can view lot reference"
  ON public.phase0_lot_reference FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- SEED LOT REFERENCE DATA
-- =====================================================

INSERT INTO public.phase0_lot_reference (lot_type, lot_number, lot_name, category, description, common_works, required_dtus, rge_eligible, eligible_aids, price_min, price_max, price_unit, complexity_level) VALUES
-- GROS OEUVRE
('demolition', '01', 'Démolition', 'gros_oeuvre', 'Travaux de démolition totale ou partielle', ARRAY['Démolition cloisons', 'Démolition murs', 'Évacuation gravats', 'Désamiantage', 'Dépose équipements'], ARRAY[]::TEXT[], FALSE, ARRAY[]::TEXT[], 30, 80, 'euro_m2', 'moderate'),
('terrassement_vrd', '02', 'Terrassement & VRD', 'gros_oeuvre', 'Terrassement et réseaux divers', ARRAY['Décapage terre végétale', 'Fouilles', 'Remblaiement', 'Tranchées réseaux', 'Évacuation terres'], ARRAY['DTU 12', 'DTU 64.1'], FALSE, ARRAY[]::TEXT[], 20, 60, 'euro_m3', 'moderate'),
('maconnerie', '03', 'Maçonnerie', 'gros_oeuvre', 'Travaux de maçonnerie générale', ARRAY['Murs parpaings', 'Murs briques', 'Murs pierre', 'Linteaux', 'Appuis de fenêtre'], ARRAY['DTU 20.1'], FALSE, ARRAY[]::TEXT[], 60, 150, 'euro_m2', 'moderate'),
('beton_arme', '04', 'Béton armé', 'gros_oeuvre', 'Ouvrages en béton armé', ARRAY['Fondations', 'Dalles', 'Poutres', 'Poteaux', 'Escaliers béton'], ARRAY['DTU 21'], FALSE, ARRAY[]::TEXT[], 150, 300, 'euro_m3', 'complex'),
('charpente_bois', '05', 'Charpente bois', 'gros_oeuvre', 'Charpente traditionnelle ou industrielle en bois', ARRAY['Charpente traditionnelle', 'Fermettes', 'Solivage', 'Traitement bois'], ARRAY['DTU 31.1', 'DTU 31.2'], FALSE, ARRAY[]::TEXT[], 80, 180, 'euro_m2', 'complex'),
('charpente_metallique', '06', 'Charpente métallique', 'gros_oeuvre', 'Charpente et structures métalliques', ARRAY['Charpente acier', 'Poutres IPN/IPE', 'Structures métalliques', 'Traitement anticorrosion'], ARRAY['DTU 32.1'], FALSE, ARRAY[]::TEXT[], 100, 250, 'euro_m2', 'expert'),
('ossature_bois', '07', 'Ossature bois', 'gros_oeuvre', 'Construction à ossature bois', ARRAY['Ossature murale', 'Planchers bois', 'Contreventement', 'Pare-vapeur'], ARRAY['DTU 31.2'], FALSE, ARRAY[]::TEXT[], 250, 450, 'euro_m2', 'complex'),

-- ENVELOPPE
('couverture', '08', 'Couverture', 'enveloppe', 'Couverture et étanchéité toiture', ARRAY['Tuiles', 'Ardoises', 'Zinc', 'Gouttières', 'Zinguerie'], ARRAY['DTU 40.11', 'DTU 40.21'], TRUE, ARRAY['maprimerénov', 'cee'], 60, 180, 'euro_m2', 'moderate'),
('etancheite', '09', 'Étanchéité', 'enveloppe', 'Étanchéité toiture terrasse et sous-sols', ARRAY['Membrane EPDM', 'Bitume', 'PVC', 'Drainage'], ARRAY['DTU 43.1'], TRUE, ARRAY['maprimerénov', 'cee'], 40, 120, 'euro_m2', 'complex'),
('ravalement', '10', 'Ravalement', 'enveloppe', 'Ravalement et traitement des façades', ARRAY['Nettoyage', 'Réparation fissures', 'Enduit', 'Peinture', 'Hydrofuge'], ARRAY['DTU 42.1'], FALSE, ARRAY[]::TEXT[], 40, 120, 'euro_m2', 'moderate'),
('ite', '11', 'Isolation Thermique par l''Extérieur', 'enveloppe', 'ITE - Isolation des murs par l''extérieur', ARRAY['Pose isolant', 'Fixation mécanique', 'Armature', 'Enduit de finition'], ARRAY['DTU 45.4'], TRUE, ARRAY['maprimerénov', 'cee', 'eco_ptz'], 100, 200, 'euro_m2', 'complex'),
('menuiseries_exterieures', '12', 'Menuiseries extérieures', 'enveloppe', 'Fenêtres, portes-fenêtres, baies vitrées', ARRAY['Dépose anciennes', 'Pose fenêtres', 'Portes-fenêtres', 'Baies coulissantes', 'Porte d''entrée'], ARRAY['DTU 36.5'], TRUE, ARRAY['maprimerénov', 'cee', 'eco_ptz'], 300, 800, 'euro_unit', 'simple'),
('fermetures', '13', 'Fermetures', 'enveloppe', 'Volets, stores, brise-soleil', ARRAY['Volets battants', 'Volets roulants', 'Stores', 'BSO', 'Motorisation'], ARRAY['DTU 34.1'], FALSE, ARRAY[]::TEXT[], 200, 600, 'euro_unit', 'simple'),
('serrurerie_exterieure', '14', 'Serrurerie extérieure', 'enveloppe', 'Garde-corps, grilles, escaliers extérieurs', ARRAY['Garde-corps', 'Grilles de défense', 'Escaliers métalliques', 'Marquises'], ARRAY['DTU 37.1'], FALSE, ARRAY[]::TEXT[], 150, 400, 'euro_ml', 'moderate'),

-- CLOISONNEMENT
('isolation_interieure', '15', 'Isolation intérieure', 'cloisonnement', 'Isolation thermique des murs et combles par l''intérieur', ARRAY['Isolation murs', 'Isolation combles', 'Isolation planchers', 'Pare-vapeur'], ARRAY['DTU 45.10'], TRUE, ARRAY['maprimerénov', 'cee', 'eco_ptz'], 25, 80, 'euro_m2', 'simple'),
('platrerie', '16', 'Plâtrerie / Cloisons sèches', 'cloisonnement', 'Cloisons et doublages en plaques de plâtre', ARRAY['Cloisons BA13', 'Doublages', 'Gaines techniques', 'Enduits joints'], ARRAY['DTU 25.41'], FALSE, ARRAY[]::TEXT[], 30, 70, 'euro_m2', 'simple'),
('cloisons_humides', '17', 'Cloisons humides', 'cloisonnement', 'Cloisons en carreaux de plâtre ou briques', ARRAY['Carreaux de plâtre', 'Briques plâtrières', 'Enduits plâtre'], ARRAY['DTU 25.31'], FALSE, ARRAY[]::TEXT[], 40, 90, 'euro_m2', 'simple'),
('faux_plafonds', '18', 'Faux plafonds', 'cloisonnement', 'Plafonds suspendus et tendus', ARRAY['Plafonds suspendus BA13', 'Dalles acoustiques', 'Plafonds tendus'], ARRAY['DTU 25.232'], FALSE, ARRAY[]::TEXT[], 25, 80, 'euro_m2', 'simple'),

-- FINITIONS
('menuiseries_interieures', '19', 'Menuiseries intérieures', 'finitions', 'Portes intérieures, placards, habillages', ARRAY['Portes intérieures', 'Portes coulissantes', 'Blocs-portes', 'Plinthes', 'Moulures'], ARRAY['DTU 36.1'], FALSE, ARRAY[]::TEXT[], 150, 500, 'euro_unit', 'simple'),
('escaliers', '20', 'Escaliers', 'finitions', 'Escaliers intérieurs bois, métal ou mixtes', ARRAY['Escalier bois', 'Escalier métal', 'Garde-corps', 'Main courante'], ARRAY['DTU 36.3'], FALSE, ARRAY[]::TEXT[], 2000, 15000, 'euro_forfait', 'complex'),
('sols_souples', '21', 'Sols souples', 'finitions', 'Moquette, vinyle, linoleum, sol PVC', ARRAY['Préparation support', 'Ragréage', 'Pose revêtement', 'Plinthes'], ARRAY['DTU 53.2'], FALSE, ARRAY[]::TEXT[], 20, 80, 'euro_m2', 'simple'),
('carrelage', '22', 'Carrelage / Faïence', 'finitions', 'Carrelage sols et murs, faïence', ARRAY['Préparation support', 'Pose carrelage', 'Pose faïence', 'Joints', 'Plinthes'], ARRAY['DTU 52.2'], FALSE, ARRAY[]::TEXT[], 40, 120, 'euro_m2', 'moderate'),
('parquet', '23', 'Parquet / Plancher bois', 'finitions', 'Parquet massif, contrecollé ou stratifié', ARRAY['Préparation support', 'Pose parquet', 'Ponçage', 'Vitrification', 'Plinthes'], ARRAY['DTU 51.1', 'DTU 51.11'], FALSE, ARRAY[]::TEXT[], 30, 150, 'euro_m2', 'moderate'),
('peinture', '24', 'Peinture / Revêtements muraux', 'finitions', 'Peinture murs et plafonds, papiers peints', ARRAY['Préparation surfaces', 'Sous-couche', 'Peinture', 'Papier peint', 'Enduits décoratifs'], ARRAY['DTU 59.1'], FALSE, ARRAY[]::TEXT[], 15, 50, 'euro_m2', 'simple'),
('agencement', '25', 'Agencement / Rangements', 'finitions', 'Placards, dressings, rangements sur mesure', ARRAY['Placards', 'Dressings', 'Bibliothèques', 'Étagères'], ARRAY[]::TEXT[], FALSE, ARRAY[]::TEXT[], 300, 800, 'euro_ml', 'moderate'),
('metallerie_interieure', '26', 'Métallerie intérieure', 'finitions', 'Garde-corps intérieurs, verrières, structures décoratives', ARRAY['Garde-corps', 'Verrières', 'Mains courantes', 'Structures acier'], ARRAY[]::TEXT[], FALSE, ARRAY[]::TEXT[], 200, 600, 'euro_ml', 'complex'),

-- ÉLECTRICITÉ
('courants_forts', '27', 'Courants forts', 'electricite', 'Installation électrique principale', ARRAY['Tableau électrique', 'Câblage', 'Prises', 'Éclairage', 'Terre'], ARRAY['NF C 15-100'], FALSE, ARRAY[]::TEXT[], 80, 150, 'euro_m2', 'moderate'),
('courants_faibles', '28', 'Courants faibles', 'electricite', 'Réseaux informatiques, TV, téléphone, interphone', ARRAY['Réseau informatique', 'TV/Satellite', 'Interphone', 'Câblage RJ45'], ARRAY['NF C 15-100'], FALSE, ARRAY[]::TEXT[], 20, 50, 'euro_m2', 'simple'),
('domotique', '29', 'Domotique', 'electricite', 'Automatisation et contrôle intelligent', ARRAY['Centrale domotique', 'Automatismes', 'Scénarios', 'Contrôle à distance'], ARRAY[]::TEXT[], FALSE, ARRAY[]::TEXT[], 2000, 15000, 'euro_forfait', 'expert'),
('photovoltaique', '30', 'Photovoltaïque', 'electricite', 'Installation panneaux solaires photovoltaïques', ARRAY['Panneaux PV', 'Onduleur', 'Câblage', 'Raccordement', 'Monitoring'], ARRAY['NF C 15-100', 'Guide UTE C 15-712'], TRUE, ARRAY['maprimerénov'], 8000, 20000, 'euro_forfait', 'complex'),

-- PLOMBERIE
('sanitaires', '31', 'Sanitaires', 'plomberie', 'Équipements sanitaires et raccordements', ARRAY['WC', 'Lavabos', 'Douches', 'Baignoires', 'Robinetterie'], ARRAY['DTU 60.1'], FALSE, ARRAY[]::TEXT[], 2000, 8000, 'euro_forfait', 'moderate'),
('eau_chaude', '32', 'Production eau chaude', 'plomberie', 'Chauffe-eau et systèmes de production ECS', ARRAY['Chauffe-eau électrique', 'Chauffe-eau thermodynamique', 'Chauffe-eau solaire', 'Ballon'], ARRAY['DTU 60.1'], TRUE, ARRAY['maprimerénov', 'cee'], 1500, 6000, 'euro_forfait', 'moderate'),
('assainissement', '33', 'Assainissement', 'plomberie', 'Évacuations et assainissement', ARRAY['Évacuations EU/EV', 'Fosse septique', 'Micro-station', 'Raccordement collectif'], ARRAY['DTU 64.1'], FALSE, ARRAY['anah'], 3000, 12000, 'euro_forfait', 'complex'),

-- CVC
('chauffage_central', '34', 'Chauffage central', 'cvc', 'Chaudière et système de chauffage central', ARRAY['Chaudière gaz', 'Chaudière fioul', 'Pompe à chaleur', 'Distribution', 'Régulation'], ARRAY['DTU 65.11'], TRUE, ARRAY['maprimerénov', 'cee', 'eco_ptz'], 5000, 20000, 'euro_forfait', 'complex'),
('chauffage_bois', '35', 'Chauffage bois', 'cvc', 'Poêles et chaudières à bois ou granulés', ARRAY['Poêle à bois', 'Poêle à granulés', 'Insert', 'Chaudière bois', 'Conduit fumée'], ARRAY['DTU 24.1'], TRUE, ARRAY['maprimerénov', 'cee', 'eco_ptz'], 3000, 15000, 'euro_forfait', 'moderate'),
('climatisation', '36', 'Climatisation', 'cvc', 'Systèmes de climatisation et rafraîchissement', ARRAY['Split', 'Multi-split', 'Gainable', 'Cassette', 'VRV'], ARRAY[]::TEXT[], FALSE, ARRAY[]::TEXT[], 2000, 12000, 'euro_forfait', 'moderate'),
('plancher_chauffant', '37', 'Plancher chauffant/rafraîchissant', 'cvc', 'Chauffage au sol hydraulique ou électrique', ARRAY['Plancher chauffant eau', 'Plancher chauffant électrique', 'Régulation', 'Chape'], ARRAY['DTU 65.14'], TRUE, ARRAY['maprimerénov', 'cee'], 50, 120, 'euro_m2', 'complex'),
('radiateurs', '38', 'Radiateurs / Émetteurs', 'cvc', 'Radiateurs et émetteurs de chaleur', ARRAY['Radiateurs eau chaude', 'Radiateurs électriques', 'Sèche-serviettes', 'Convecteurs'], ARRAY['DTU 65.10'], FALSE, ARRAY[]::TEXT[], 200, 800, 'euro_unit', 'simple'),

-- VENTILATION
('vmc_simple_flux', '39', 'VMC Simple flux', 'ventilation', 'Ventilation mécanique contrôlée simple flux', ARRAY['Caisson VMC', 'Réseau gaines', 'Bouches extraction', 'Entrées d''air'], ARRAY['DTU 68.3'], TRUE, ARRAY['maprimerénov', 'cee'], 500, 2000, 'euro_forfait', 'simple'),
('vmc_double_flux', '40', 'VMC Double flux', 'ventilation', 'VMC double flux avec récupération de chaleur', ARRAY['Centrale DF', 'Réseau soufflage', 'Réseau extraction', 'Récupérateur', 'Filtres'], ARRAY['DTU 68.3'], TRUE, ARRAY['maprimerénov', 'cee', 'eco_ptz'], 4000, 10000, 'euro_forfait', 'complex'),
('ventilation_naturelle', '41', 'Ventilation naturelle', 'ventilation', 'Ventilation naturelle assistée ou non', ARRAY['Grilles haute/basse', 'Conduits shunt', 'Extracteurs statiques', 'VMR'], ARRAY['DTU 68.2'], FALSE, ARRAY[]::TEXT[], 300, 1500, 'euro_forfait', 'simple'),

-- EXTÉRIEURS
('piscine', '42', 'Piscine', 'exterieurs', 'Construction de piscine', ARRAY['Terrassement', 'Structure', 'Étanchéité', 'Filtration', 'Revêtement', 'Plages'], ARRAY['DTU 65.3'], FALSE, ARRAY[]::TEXT[], 15000, 80000, 'euro_forfait', 'expert'),
('amenagements_exterieurs', '43', 'Aménagements extérieurs', 'exterieurs', 'Terrasses, allées, jardins', ARRAY['Terrasse bois', 'Terrasse carrelée', 'Dallage', 'Engazonnement', 'Plantations'], ARRAY['DTU 51.4'], FALSE, ARRAY[]::TEXT[], 50, 200, 'euro_m2', 'moderate'),
('clotures', '44', 'Clôtures / Portails', 'exterieurs', 'Clôtures, portails et portillons', ARRAY['Clôture grillage', 'Clôture aluminium', 'Portail coulissant', 'Portail battant', 'Motorisation'], ARRAY[]::TEXT[], FALSE, ARRAY[]::TEXT[], 80, 300, 'euro_ml', 'simple'),
('eclairage_exterieur', '45', 'Éclairage extérieur', 'exterieurs', 'Éclairage de jardin et façade', ARRAY['Bornes', 'Spots encastrés', 'Appliques', 'Projecteurs', 'Guirlandes', 'Solaire'], ARRAY['NF C 15-100'], FALSE, ARRAY[]::TEXT[], 1000, 5000, 'euro_forfait', 'simple'),

-- SPÉCIAUX
('ascenseur', '46', 'Ascenseur / Monte-charge', 'speciaux', 'Ascenseur privatif ou monte-charge', ARRAY['Gaine', 'Cabine', 'Machinerie', 'Portes palières', 'Sécurités'], ARRAY[]::TEXT[], FALSE, ARRAY['anah'], 15000, 40000, 'euro_forfait', 'expert'),
('cuisine_equipee', '47', 'Cuisine équipée', 'speciaux', 'Fourniture et pose cuisine équipée', ARRAY['Meubles', 'Plan de travail', 'Électroménager', 'Crédence', 'Évier', 'Robinetterie'], ARRAY[]::TEXT[], FALSE, ARRAY[]::TEXT[], 5000, 30000, 'euro_forfait', 'moderate'),
('salle_bain_cle_main', '48', 'Salle de bain clé en main', 'speciaux', 'Rénovation complète salle de bain', ARRAY['Dépose', 'Plomberie', 'Électricité', 'Carrelage', 'Faïence', 'Sanitaires', 'Meubles'], ARRAY['DTU 60.1', 'DTU 52.2'], FALSE, ARRAY['anah'], 5000, 20000, 'euro_forfait', 'moderate');

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.phase0_projects IS 'Main table for Phase 0 projects (project definition before quotes)';
COMMENT ON TABLE public.phase0_wizard_progress IS 'Tracks wizard progress for each project';
COMMENT ON TABLE public.phase0_selected_lots IS 'Selected work lots for each project';
COMMENT ON TABLE public.phase0_deductions IS 'AI deduction history for each project';
COMMENT ON TABLE public.phase0_documents IS 'Generated documents (CCF, APS, CCTP, etc.)';
COMMENT ON TABLE public.phase0_api_cache IS 'Cache for external API calls (BAN, Géorisques, etc.)';
COMMENT ON TABLE public.phase0_lot_reference IS 'Reference data for 48 BTP work lots';
