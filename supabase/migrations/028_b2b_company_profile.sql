-- =====================================================
-- Migration 028: Profil Entreprise B2B Enrichi
-- Ajout des champs de mémoire technique pré-remplis
-- Tables pour employés et affectation aux projets
-- =====================================================

-- =============================================================================
-- ENRICHISSEMENT TABLE USERS (Profil Entreprise B2B)
-- =============================================================================

-- Champs pour le mémoire technique (pré-remplis depuis profil)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS company_description TEXT,
ADD COLUMN IF NOT EXISTS company_human_resources TEXT,
ADD COLUMN IF NOT EXISTS company_material_resources TEXT,
ADD COLUMN IF NOT EXISTS company_methodology TEXT,
ADD COLUMN IF NOT EXISTS company_quality_commitments TEXT,
ADD COLUMN IF NOT EXISTS company_certifications JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS company_references JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS company_documents JSONB DEFAULT '[]';

-- Champs complémentaires entreprise
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS company_address TEXT,
ADD COLUMN IF NOT EXISTS company_code_ape TEXT,
ADD COLUMN IF NOT EXISTS company_rcs TEXT,
ADD COLUMN IF NOT EXISTS company_capital TEXT,
ADD COLUMN IF NOT EXISTS company_creation_date DATE,
ADD COLUMN IF NOT EXISTS company_effectif INTEGER,
ADD COLUMN IF NOT EXISTS company_ca_annuel DECIMAL(15,2);

-- Index pour recherche
CREATE INDEX IF NOT EXISTS idx_users_company_siret ON public.users(company_siret) WHERE company_siret IS NOT NULL;

-- Commentaires
COMMENT ON COLUMN public.users.company_description IS 'Présentation de l''entreprise pour mémoire technique';
COMMENT ON COLUMN public.users.company_human_resources IS 'Description des moyens humains';
COMMENT ON COLUMN public.users.company_material_resources IS 'Description des moyens matériels';
COMMENT ON COLUMN public.users.company_methodology IS 'Méthodologie d''intervention type';
COMMENT ON COLUMN public.users.company_quality_commitments IS 'Engagements qualité';
COMMENT ON COLUMN public.users.company_certifications IS 'Certifications et qualifications (RGE, Qualibat, etc.)';
COMMENT ON COLUMN public.users.company_references IS 'Références chantiers similaires';
COMMENT ON COLUMN public.users.company_documents IS 'Documents administratifs (Kbis, attestations, etc.)';

-- =============================================================================
-- TABLE: company_employees (Salariés de l'entreprise)
-- =============================================================================

CREATE TABLE IF NOT EXISTS company_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Identification
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),

  -- Poste
  job_title VARCHAR(150) NOT NULL,
  department VARCHAR(100),
  is_manager BOOLEAN DEFAULT FALSE,
  hire_date DATE,

  -- Qualifications
  qualifications JSONB DEFAULT '[]',
  certifications JSONB DEFAULT '[]',
  habilitations JSONB DEFAULT '[]',

  -- Compétences
  skills JSONB DEFAULT '[]',
  experience_years INTEGER,

  -- Disponibilité
  availability_status VARCHAR(20) DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'on_leave', 'unavailable')),
  current_project_id UUID,

  -- Photo
  avatar_url TEXT,

  -- Métadonnées
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_employees_user ON company_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON company_employees(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_employees_availability ON company_employees(availability_status) WHERE is_active = TRUE;

-- RLS
ALTER TABLE company_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own employees" ON company_employees
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own employees" ON company_employees
  FOR ALL USING (user_id = auth.uid());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_employees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_employees_updated_at ON company_employees;
CREATE TRIGGER trigger_employees_updated_at
  BEFORE UPDATE ON company_employees
  FOR EACH ROW EXECUTE FUNCTION update_employees_updated_at();

-- Commentaires
COMMENT ON TABLE company_employees IS 'Salariés des entreprises B2B';
COMMENT ON COLUMN company_employees.qualifications IS 'Qualifications professionnelles (CAP, BEP, BP, etc.)';
COMMENT ON COLUMN company_employees.certifications IS 'Certifications obtenues';
COMMENT ON COLUMN company_employees.habilitations IS 'Habilitations (électrique, travail en hauteur, etc.)';

-- =============================================================================
-- TABLE: project_team_assignments (Affectation équipes aux projets)
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES phase0_projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES company_employees(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Rôle sur le projet
  role VARCHAR(100) NOT NULL,
  is_lead BOOLEAN DEFAULT FALSE,

  -- Période
  start_date DATE,
  end_date DATE,

  -- Charge de travail
  allocation_percentage INTEGER DEFAULT 100 CHECK (allocation_percentage BETWEEN 0 AND 100),

  -- Statut
  status VARCHAR(20) DEFAULT 'assigned' CHECK (status IN ('planned', 'assigned', 'active', 'completed', 'removed')),

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contrainte d'unicité
  UNIQUE(project_id, employee_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_team_project ON project_team_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_team_employee ON project_team_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_team_user ON project_team_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_team_active ON project_team_assignments(project_id, status) WHERE status IN ('assigned', 'active');

-- RLS
ALTER TABLE project_team_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own team assignments" ON project_team_assignments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own team assignments" ON project_team_assignments
  FOR ALL USING (user_id = auth.uid());

-- Trigger updated_at
DROP TRIGGER IF EXISTS trigger_team_updated_at ON project_team_assignments;
CREATE TRIGGER trigger_team_updated_at
  BEFORE UPDATE ON project_team_assignments
  FOR EACH ROW EXECUTE FUNCTION update_employees_updated_at();

-- Commentaires
COMMENT ON TABLE project_team_assignments IS 'Affectation des employés aux projets';
COMMENT ON COLUMN project_team_assignments.allocation_percentage IS 'Pourcentage du temps de travail dédié au projet';

-- =============================================================================
-- TABLE: company_documents (Documents entreprise avec suivi validité)
-- =============================================================================

CREATE TABLE IF NOT EXISTS company_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Type de document
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
    'kbis', 'attestation_urssaf', 'attestation_fiscale', 'attestation_assurance_decennale',
    'attestation_assurance_rc', 'certificat_rge', 'certificat_qualibat', 'certificat_qualifelec',
    'carte_pro_btp', 'attestation_regularite_sociale', 'rib', 'other'
  )),
  document_name VARCHAR(255) NOT NULL,

  -- Fichier
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size INTEGER,
  mime_type VARCHAR(100),

  -- Validité
  issue_date DATE,
  expiry_date DATE,
  is_valid BOOLEAN DEFAULT TRUE,

  -- Vérification
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  verification_notes TEXT,

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_company_docs_user ON company_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_company_docs_type ON company_documents(user_id, document_type);
CREATE INDEX IF NOT EXISTS idx_company_docs_expiry ON company_documents(expiry_date) WHERE is_valid = TRUE;

-- RLS
ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents" ON company_documents
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own documents" ON company_documents
  FOR ALL USING (user_id = auth.uid());

-- Trigger updated_at
DROP TRIGGER IF EXISTS trigger_company_docs_updated_at ON company_documents;
CREATE TRIGGER trigger_company_docs_updated_at
  BEFORE UPDATE ON company_documents
  FOR EACH ROW EXECUTE FUNCTION update_employees_updated_at();

-- Commentaires
COMMENT ON TABLE company_documents IS 'Documents administratifs des entreprises B2B avec suivi de validité';

-- =============================================================================
-- FONCTION: Vérifier documents expirés
-- =============================================================================

CREATE OR REPLACE FUNCTION check_expired_documents()
RETURNS TABLE (
  user_id UUID,
  document_id UUID,
  document_type VARCHAR(50),
  document_name VARCHAR(255),
  expiry_date DATE,
  days_until_expiry INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cd.user_id,
    cd.id as document_id,
    cd.document_type,
    cd.document_name,
    cd.expiry_date,
    (cd.expiry_date - CURRENT_DATE)::INTEGER as days_until_expiry
  FROM company_documents cd
  WHERE cd.is_valid = TRUE
    AND cd.expiry_date IS NOT NULL
    AND cd.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
  ORDER BY cd.expiry_date ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_expired_documents IS 'Retourne les documents expirant dans les 30 prochains jours';

-- =============================================================================
-- Mise à jour du calcul de complétion profil B2B
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_profile_completion(user_row public.users)
RETURNS INTEGER AS $$
DECLARE
  total_fields INTEGER := 0;
  filled_fields INTEGER := 0;
BEGIN
  -- Champs communs (obligatoires)
  total_fields := total_fields + 4;
  IF user_row.name IS NOT NULL AND user_row.name != '' THEN filled_fields := filled_fields + 1; END IF;
  IF user_row.email IS NOT NULL AND user_row.email != '' THEN filled_fields := filled_fields + 1; END IF;
  IF user_row.phone IS NOT NULL AND user_row.phone != '' THEN filled_fields := filled_fields + 1; END IF;
  IF user_row.city IS NOT NULL AND user_row.city != '' THEN filled_fields := filled_fields + 1; END IF;

  -- Champs selon le type d'utilisateur
  IF user_row.user_type = 'B2C' THEN
    total_fields := total_fields + 3;
    IF user_row.property_type IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.property_surface IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.postal_code IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  ELSIF user_row.user_type = 'B2B' THEN
    -- Champs B2B enrichis
    total_fields := total_fields + 8;
    IF user_row.company IS NOT NULL AND user_row.company != '' THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.company_siret IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.company_role IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.company_description IS NOT NULL AND user_row.company_description != '' THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.company_human_resources IS NOT NULL AND user_row.company_human_resources != '' THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.company_methodology IS NOT NULL AND user_row.company_methodology != '' THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.company_certifications IS NOT NULL AND user_row.company_certifications != '[]'::jsonb THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.company_documents IS NOT NULL AND user_row.company_documents != '[]'::jsonb THEN filled_fields := filled_fields + 1; END IF;
  ELSIF user_row.user_type = 'B2G' THEN
    total_fields := total_fields + 3;
    IF user_row.entity_name IS NOT NULL AND user_row.entity_name != '' THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.entity_type IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.entity_function IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  END IF;

  IF total_fields = 0 THEN RETURN 0; END IF;
  RETURN ROUND((filled_fields::DECIMAL / total_fields) * 100);
END;
$$ LANGUAGE plpgsql;
