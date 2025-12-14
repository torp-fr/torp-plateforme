-- =====================================================
-- Migration 028: Profil Entreprise B2B Enrichi
-- Ajout des champs pour le mémoire technique automatique
-- et gestion des employés
-- =====================================================

-- =====================================================
-- 1. ENRICHIR LE PROFIL ENTREPRISE (users table)
-- =====================================================

-- Présentation de l'entreprise
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS company_description TEXT,
ADD COLUMN IF NOT EXISTS company_history TEXT,
ADD COLUMN IF NOT EXISTS company_specialties TEXT[], -- Spécialités métier
ADD COLUMN IF NOT EXISTS company_certifications JSONB DEFAULT '[]', -- Qualibat, RGE, etc.

-- Moyens
ADD COLUMN IF NOT EXISTS company_human_resources TEXT, -- Description moyens humains
ADD COLUMN IF NOT EXISTS company_material_resources TEXT, -- Description moyens matériels
ADD COLUMN IF NOT EXISTS company_equipment JSONB DEFAULT '[]', -- Liste équipements

-- Engagements et méthodologie
ADD COLUMN IF NOT EXISTS company_methodology TEXT, -- Méthodologie d'intervention type
ADD COLUMN IF NOT EXISTS company_quality_commitments TEXT, -- Engagements qualité
ADD COLUMN IF NOT EXISTS company_warranties TEXT, -- Garanties proposées

-- Références
ADD COLUMN IF NOT EXISTS company_references JSONB DEFAULT '[]', -- Références chantiers

-- Documents administratifs (URLs)
ADD COLUMN IF NOT EXISTS company_documents JSONB DEFAULT '{}'; -- kbis, decennale, urssaf, rge, etc.

-- =====================================================
-- 2. TABLE EMPLOYÉS
-- =====================================================

CREATE TABLE IF NOT EXISTS company_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lien avec l'entreprise (utilisateur B2B qui crée les employés)
  company_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Identité
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,

  -- Poste
  job_title TEXT NOT NULL, -- Fonction/poste
  department TEXT, -- Service
  role_type TEXT CHECK (role_type IN ('manager', 'technician', 'apprentice', 'administrative', 'other')),

  -- Compétences
  qualifications JSONB DEFAULT '[]', -- Qualifications, habilitations
  skills TEXT[], -- Compétences
  years_experience INTEGER,

  -- Contrat
  contract_type TEXT CHECK (contract_type IN ('cdi', 'cdd', 'interim', 'apprentice', 'intern')),
  hire_date DATE,

  -- Disponibilité
  is_active BOOLEAN DEFAULT TRUE,
  availability_status TEXT CHECK (availability_status IN ('available', 'on_project', 'unavailable', 'vacation')),
  current_project_id UUID, -- Projet en cours

  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_company_employees_company ON company_employees(company_user_id);
CREATE INDEX IF NOT EXISTS idx_company_employees_available ON company_employees(company_user_id, is_active, availability_status);

-- =====================================================
-- 3. TABLE AFFECTATION EMPLOYÉS AUX PROJETS
-- =====================================================

CREATE TABLE IF NOT EXISTS project_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liens
  project_id UUID NOT NULL REFERENCES phase0_projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES company_employees(id) ON DELETE CASCADE,
  company_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Rôle sur le projet
  project_role TEXT NOT NULL, -- Chef de chantier, Ouvrier, etc.
  responsibilities TEXT, -- Responsabilités spécifiques

  -- Planning
  start_date DATE,
  end_date DATE,
  hours_per_week DECIMAL(4,1),

  -- Statut
  status TEXT CHECK (status IN ('planned', 'active', 'completed', 'cancelled')) DEFAULT 'planned',

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, employee_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_team_assignments_project ON project_team_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_team_assignments_employee ON project_team_assignments(employee_id);

-- =====================================================
-- 4. RLS POLICIES
-- =====================================================

ALTER TABLE company_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_team_assignments ENABLE ROW LEVEL SECURITY;

-- Employés: visible et gérable par l'entreprise propriétaire
CREATE POLICY "Company can manage own employees" ON company_employees
  FOR ALL USING (company_user_id = auth.uid());

-- Affectations: visible par l'entreprise et le propriétaire du projet
CREATE POLICY "Company can manage own team assignments" ON project_team_assignments
  FOR ALL USING (company_user_id = auth.uid());

CREATE POLICY "Project owner can view team assignments" ON project_team_assignments
  FOR SELECT USING (
    project_id IN (SELECT id FROM phase0_projects WHERE user_id = auth.uid())
  );

-- =====================================================
-- 5. TRIGGER UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_company_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_company_employees_timestamp
  BEFORE UPDATE ON company_employees
  FOR EACH ROW EXECUTE FUNCTION update_company_updated_at();

CREATE TRIGGER update_team_assignments_timestamp
  BEFORE UPDATE ON project_team_assignments
  FOR EACH ROW EXECUTE FUNCTION update_company_updated_at();

-- =====================================================
-- 6. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE company_employees IS 'Employés des entreprises B2B';
COMMENT ON TABLE project_team_assignments IS 'Affectations des employés aux projets';

COMMENT ON COLUMN public.users.company_description IS 'Description/présentation de l''entreprise';
COMMENT ON COLUMN public.users.company_certifications IS 'Certifications (Qualibat, RGE, etc.) en JSON';
COMMENT ON COLUMN public.users.company_human_resources IS 'Description des moyens humains';
COMMENT ON COLUMN public.users.company_material_resources IS 'Description des moyens matériels';
COMMENT ON COLUMN public.users.company_methodology IS 'Méthodologie d''intervention type';
COMMENT ON COLUMN public.users.company_quality_commitments IS 'Engagements qualité';
COMMENT ON COLUMN public.users.company_references IS 'Références chantiers en JSON';
COMMENT ON COLUMN public.users.company_documents IS 'Documents administratifs (URLs) en JSON';
