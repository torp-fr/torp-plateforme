-- =====================================================
-- Migration 030: Moyens Matériels Entreprise B2B
-- Gestion structurée du parc matériel (véhicules, engins, outillage, etc.)
-- =====================================================

-- =============================================================================
-- TABLE: company_materials (Parc matériel de l'entreprise)
-- =============================================================================

DROP TABLE IF EXISTS company_materials CASCADE;

CREATE TABLE company_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Catégorie (6 catégories principales)
  category VARCHAR(30) NOT NULL CHECK (category IN (
    'vehicules', 'engins', 'outillage', 'equipements', 'informatique', 'locaux'
  )),

  -- Type et identification
  type VARCHAR(150) NOT NULL,
  name VARCHAR(150),
  brand VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(100),

  -- Quantité
  quantity INTEGER DEFAULT 1 CHECK (quantity >= 0),

  -- Propriété ou location
  is_owned BOOLEAN DEFAULT TRUE,
  rental_company VARCHAR(150),

  -- Dates
  year_acquisition INTEGER CHECK (year_acquisition >= 1900 AND year_acquisition <= 2100),
  purchase_date DATE,
  warranty_end_date DATE,

  -- Valeur
  purchase_value DECIMAL(12,2),
  current_value DECIMAL(12,2),

  -- État et maintenance
  condition VARCHAR(20) DEFAULT 'good' CHECK (condition IN ('new', 'excellent', 'good', 'fair', 'poor')),
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  maintenance_notes TEXT,

  -- Disponibilité
  availability_status VARCHAR(20) DEFAULT 'available' CHECK (availability_status IN (
    'available', 'in_use', 'maintenance', 'out_of_service', 'sold'
  )),
  current_project_id UUID,

  -- Localisation
  location VARCHAR(200),

  -- Documents (certificats, contrôles techniques, etc.)
  documents JSONB DEFAULT '[]',

  -- Caractéristiques techniques (selon catégorie)
  specifications JSONB DEFAULT '{}',

  -- Notes
  notes TEXT,

  -- Statut
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_materials_owner ON company_materials(owner_id);
CREATE INDEX idx_materials_category ON company_materials(owner_id, category);
CREATE INDEX idx_materials_active ON company_materials(owner_id, is_active);
CREATE INDEX idx_materials_availability ON company_materials(availability_status) WHERE is_active = TRUE;
CREATE INDEX idx_materials_project ON company_materials(current_project_id) WHERE current_project_id IS NOT NULL;

-- RLS
ALTER TABLE company_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own materials" ON company_materials;
CREATE POLICY "Users can view own materials" ON company_materials
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own materials" ON company_materials;
CREATE POLICY "Users can manage own materials" ON company_materials
  FOR ALL USING (owner_id = auth.uid());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_materials_updated_at ON company_materials;
CREATE TRIGGER trigger_materials_updated_at
  BEFORE UPDATE ON company_materials
  FOR EACH ROW EXECUTE FUNCTION update_materials_updated_at();

-- Commentaires
COMMENT ON TABLE company_materials IS 'Parc matériel des entreprises B2B';
COMMENT ON COLUMN company_materials.owner_id IS 'Propriétaire (utilisateur B2B)';
COMMENT ON COLUMN company_materials.category IS 'Catégorie: vehicules, engins, outillage, equipements, informatique, locaux';
COMMENT ON COLUMN company_materials.is_owned IS 'true = propriété, false = location/leasing';
COMMENT ON COLUMN company_materials.specifications IS 'Caractéristiques techniques spécifiques selon le type';

-- =============================================================================
-- TABLE: project_material_assignments (Affectation matériel aux projets)
-- =============================================================================

DROP TABLE IF EXISTS project_material_assignments CASCADE;

CREATE TABLE project_material_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES phase0_projects(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES company_materials(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Quantité affectée (pour matériel comptable comme outillage)
  quantity_assigned INTEGER DEFAULT 1,

  -- Période d'affectation
  start_date DATE,
  end_date DATE,

  -- Statut
  status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'deployed', 'returned', 'cancelled')),

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contrainte d'unicité (un matériel ne peut être affecté qu'une fois à un projet)
  UNIQUE(project_id, material_id)
);

-- Index
CREATE INDEX idx_mat_assign_project ON project_material_assignments(project_id);
CREATE INDEX idx_mat_assign_material ON project_material_assignments(material_id);
CREATE INDEX idx_mat_assign_owner ON project_material_assignments(owner_id);
CREATE INDEX idx_mat_assign_active ON project_material_assignments(status) WHERE status IN ('planned', 'deployed');

-- RLS
ALTER TABLE project_material_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own material assignments" ON project_material_assignments;
CREATE POLICY "Users can view own material assignments" ON project_material_assignments
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own material assignments" ON project_material_assignments;
CREATE POLICY "Users can manage own material assignments" ON project_material_assignments
  FOR ALL USING (owner_id = auth.uid());

-- Trigger updated_at
DROP TRIGGER IF EXISTS trigger_mat_assign_updated_at ON project_material_assignments;
CREATE TRIGGER trigger_mat_assign_updated_at
  BEFORE UPDATE ON project_material_assignments
  FOR EACH ROW EXECUTE FUNCTION update_materials_updated_at();

-- Commentaires
COMMENT ON TABLE project_material_assignments IS 'Affectation du matériel aux projets de chantier';

-- =============================================================================
-- FONCTIONS UTILITAIRES
-- =============================================================================

-- Fonction pour obtenir le résumé des moyens matériels par catégorie
CREATE OR REPLACE FUNCTION get_material_summary(user_uuid UUID)
RETURNS TABLE (
  category VARCHAR(30),
  total_items BIGINT,
  total_value DECIMAL(15,2),
  available_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.category,
    SUM(m.quantity)::BIGINT AS total_items,
    SUM(COALESCE(m.current_value, m.purchase_value, 0) * m.quantity) AS total_value,
    SUM(CASE WHEN m.availability_status = 'available' THEN m.quantity ELSE 0 END)::BIGINT AS available_count
  FROM company_materials m
  WHERE m.owner_id = user_uuid
    AND m.is_active = TRUE
  GROUP BY m.category
  ORDER BY m.category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir les maintenances à venir
CREATE OR REPLACE FUNCTION get_upcoming_maintenance()
RETURNS TABLE (
  material_owner_id UUID,
  material_id UUID,
  material_name VARCHAR(150),
  material_type VARCHAR(150),
  maintenance_date DATE,
  days_until INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.owner_id AS material_owner_id,
    m.id AS material_id,
    m.name AS material_name,
    m.type AS material_type,
    m.next_maintenance_date AS maintenance_date,
    (m.next_maintenance_date - CURRENT_DATE)::INTEGER AS days_until
  FROM company_materials m
  WHERE m.is_active = TRUE
    AND m.next_maintenance_date IS NOT NULL
    AND m.next_maintenance_date <= CURRENT_DATE + INTERVAL '30 days'
  ORDER BY m.next_maintenance_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_material_summary IS 'Retourne le résumé des moyens matériels par catégorie pour un utilisateur';
COMMENT ON FUNCTION get_upcoming_maintenance IS 'Retourne les maintenances prévues dans les 30 prochains jours';
