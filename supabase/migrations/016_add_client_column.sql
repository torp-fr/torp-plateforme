-- Migration: Add client column for B2B projects
-- This column stores client/MOA (Maître d'Ouvrage) information
-- for professional users who work on behalf of their clients

-- =====================================================
-- ADD CLIENT COLUMN
-- =====================================================

-- Add client column (JSONB for flexibility)
ALTER TABLE public.phase0_projects
ADD COLUMN IF NOT EXISTS client JSONB DEFAULT '{}'::jsonb;

-- Add GIN index for client searches
CREATE INDEX IF NOT EXISTS idx_phase0_projects_client
ON public.phase0_projects USING GIN (client);

-- Add denormalized columns for quick access to client info
ALTER TABLE public.phase0_projects
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS client_type TEXT,
ADD COLUMN IF NOT EXISTS client_city TEXT;

-- Create indexes on denormalized columns
CREATE INDEX IF NOT EXISTS idx_phase0_projects_client_name
ON public.phase0_projects(client_name);

CREATE INDEX IF NOT EXISTS idx_phase0_projects_client_type
ON public.phase0_projects(client_type);

CREATE INDEX IF NOT EXISTS idx_phase0_projects_client_city
ON public.phase0_projects(client_city);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON COLUMN public.phase0_projects.client IS 'B2B client/MOA information (for professional users managing client projects)';
COMMENT ON COLUMN public.phase0_projects.client_name IS 'Denormalized client name for quick queries';
COMMENT ON COLUMN public.phase0_projects.client_type IS 'Client type: particulier, entreprise, copropriete, collectivite, bailleur, promoteur';
COMMENT ON COLUMN public.phase0_projects.client_city IS 'Client site city for quick queries';

-- =====================================================
-- UPDATE COMPLETENESS FUNCTION FOR B2B
-- =====================================================

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
  is_b2b BOOLEAN;
BEGIN
  SELECT * INTO p FROM public.phase0_projects WHERE id = project_id;

  IF p IS NULL THEN
    RETURN 0;
  END IF;

  total_weight := owner_weight + property_weight + lots_weight + constraints_weight + budget_weight + validation_weight;

  -- Check if this is a B2B project
  is_b2b := p.wizard_mode IN ('b2b_professional');

  -- For B2B: Check client info instead of owner profile
  IF is_b2b THEN
    IF p.client ? 'identity' AND p.client->'identity' ? 'clientType' THEN
      completed_weight := completed_weight + (owner_weight * 0.5);
      IF p.client ? 'contact' AND p.client->'contact' ? 'email' THEN
        completed_weight := completed_weight + (owner_weight * 0.5);
      END IF;
    END IF;

    -- Check site info for B2B (stored in client.site)
    IF p.client ? 'site' AND p.client->'site' ? 'address' THEN
      completed_weight := completed_weight + (property_weight * 0.4);
      IF p.client->'site' ? 'characteristics' THEN
        completed_weight := completed_weight + (property_weight * 0.3);
      END IF;
      IF p.client->'site' ? 'occupancy' THEN
        completed_weight := completed_weight + (property_weight * 0.3);
      END IF;
    END IF;
  ELSE
    -- Standard B2C checks
    IF p.owner_profile ? 'identity' AND p.owner_profile->'identity' ? 'type' THEN
      completed_weight := completed_weight + (owner_weight * 0.5);
      IF p.owner_profile ? 'contact' THEN
        completed_weight := completed_weight + (owner_weight * 0.5);
      END IF;
    END IF;

    IF p.property ? 'identification' AND p.property->'identification' ? 'address' THEN
      completed_weight := completed_weight + (property_weight * 0.4);
      IF p.property ? 'characteristics' THEN
        completed_weight := completed_weight + (property_weight * 0.3);
      END IF;
      IF p.property ? 'currentCondition' THEN
        completed_weight := completed_weight + (property_weight * 0.3);
      END IF;
    END IF;
  END IF;

  -- Check lots selection (same for B2B and B2C)
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
