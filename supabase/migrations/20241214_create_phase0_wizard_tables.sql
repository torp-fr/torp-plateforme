-- =============================================================================
-- Migration: Création des tables Phase 0 Wizard
-- Date: 2024-12-14
-- Description: Tables pour la progression du wizard et les déductions IA
-- =============================================================================

-- =============================================================================
-- TABLE: phase0_wizard_progress
-- Stocke la progression de l'utilisateur dans le wizard Phase 0
-- =============================================================================

CREATE TABLE IF NOT EXISTS phase0_wizard_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES phase0_projects(id) ON DELETE CASCADE,

  -- Progression
  current_step INTEGER NOT NULL DEFAULT 1,
  total_steps INTEGER NOT NULL DEFAULT 6,

  -- Données des étapes (JSON)
  step_data JSONB DEFAULT '{}'::jsonb,
  step_completion JSONB DEFAULT '{}'::jsonb,

  -- Déductions et validation
  pending_deductions JSONB DEFAULT '[]'::jsonb,
  validation_errors JSONB DEFAULT '[]'::jsonb,

  -- Session tracking
  session_id TEXT,
  session_started_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  total_time_spent INTEGER DEFAULT 0, -- en secondes

  -- Device info (optionnel)
  device_type TEXT,
  browser TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contrainte d'unicité sur project_id
  CONSTRAINT unique_project_wizard_progress UNIQUE (project_id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_wizard_progress_project_id ON phase0_wizard_progress(project_id);
CREATE INDEX IF NOT EXISTS idx_wizard_progress_session_id ON phase0_wizard_progress(session_id);
CREATE INDEX IF NOT EXISTS idx_wizard_progress_last_active ON phase0_wizard_progress(last_active_at);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_wizard_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_wizard_progress_updated_at ON phase0_wizard_progress;
CREATE TRIGGER trigger_wizard_progress_updated_at
  BEFORE UPDATE ON phase0_wizard_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_wizard_progress_updated_at();

-- =============================================================================
-- TABLE: phase0_deductions
-- Stocke les déductions IA appliquées aux projets
-- =============================================================================

CREATE TABLE IF NOT EXISTS phase0_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES phase0_projects(id) ON DELETE CASCADE,

  -- Règle de déduction
  rule_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'property_enrichment', 'budget_estimation', etc.

  -- Statut d'exécution
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'error', 'skipped'
  executed_at TIMESTAMPTZ,
  execution_time_ms INTEGER,

  -- Données source et cible
  source_data JSONB,
  source_fields TEXT[] DEFAULT '{}',
  target_field TEXT NOT NULL,
  deduced_value JSONB,

  -- Confiance et raisonnement
  confidence DECIMAL(3,2), -- 0.00 à 1.00
  reasoning TEXT,

  -- Action utilisateur
  user_action TEXT, -- 'accepted', 'rejected', 'modified', null
  user_action_at TIMESTAMPTZ,
  user_override_value JSONB,

  -- Erreurs éventuelles
  error_code TEXT,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_deductions_project_id ON phase0_deductions(project_id);
CREATE INDEX IF NOT EXISTS idx_deductions_rule_id ON phase0_deductions(rule_id);
CREATE INDEX IF NOT EXISTS idx_deductions_status ON phase0_deductions(status);
CREATE INDEX IF NOT EXISTS idx_deductions_category ON phase0_deductions(category);
CREATE INDEX IF NOT EXISTS idx_deductions_target_field ON phase0_deductions(target_field);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_deductions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_deductions_updated_at ON phase0_deductions;
CREATE TRIGGER trigger_deductions_updated_at
  BEFORE UPDATE ON phase0_deductions
  FOR EACH ROW
  EXECUTE FUNCTION update_deductions_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Activer RLS
ALTER TABLE phase0_wizard_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase0_deductions ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies existantes si elles existent
DROP POLICY IF EXISTS "Users can view own wizard progress" ON phase0_wizard_progress;
DROP POLICY IF EXISTS "Users can insert own wizard progress" ON phase0_wizard_progress;
DROP POLICY IF EXISTS "Users can update own wizard progress" ON phase0_wizard_progress;
DROP POLICY IF EXISTS "Users can delete own wizard progress" ON phase0_wizard_progress;
DROP POLICY IF EXISTS "Users can manage own wizard progress" ON phase0_wizard_progress;

DROP POLICY IF EXISTS "Users can view own deductions" ON phase0_deductions;
DROP POLICY IF EXISTS "Users can insert own deductions" ON phase0_deductions;
DROP POLICY IF EXISTS "Users can update own deductions" ON phase0_deductions;
DROP POLICY IF EXISTS "Users can delete own deductions" ON phase0_deductions;
DROP POLICY IF EXISTS "Users can manage own deductions" ON phase0_deductions;

-- Policies pour phase0_wizard_progress (policy unique pour toutes les opérations)
CREATE POLICY "Users can manage own wizard progress"
  ON phase0_wizard_progress
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    )
  );

-- Policies pour phase0_deductions (policy unique pour toutes les opérations)
CREATE POLICY "Users can manage own deductions"
  ON phase0_deductions
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM phase0_projects WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- COMMENTAIRES
-- =============================================================================

COMMENT ON TABLE phase0_wizard_progress IS 'Stocke la progression des utilisateurs dans le wizard Phase 0';
COMMENT ON TABLE phase0_deductions IS 'Stocke les déductions IA appliquées aux projets Phase 0';

COMMENT ON COLUMN phase0_wizard_progress.step_data IS 'Données JSON des réponses par étape';
COMMENT ON COLUMN phase0_wizard_progress.step_completion IS 'État de complétion de chaque étape';
COMMENT ON COLUMN phase0_wizard_progress.pending_deductions IS 'Déductions en attente de validation';

COMMENT ON COLUMN phase0_deductions.confidence IS 'Niveau de confiance de la déduction (0.00 à 1.00)';
COMMENT ON COLUMN phase0_deductions.user_action IS 'Action de l''utilisateur: accepted, rejected, modified';
COMMENT ON COLUMN phase0_deductions.user_override_value IS 'Valeur modifiée par l''utilisateur si différente';
