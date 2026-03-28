-- ============================================================
-- Migration: orchestration_runs
-- Phase 3B — Engine endpoints backend
-- Table nécessaire pour GET /api/v1/engine/orchestration
-- ============================================================

CREATE TABLE IF NOT EXISTS public.orchestration_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identité
  name          VARCHAR(255) NOT NULL DEFAULT 'Orchestration',

  -- Volumes
  input_count   INTEGER NOT NULL DEFAULT 0,
  output_count  INTEGER NOT NULL DEFAULT 0,
  error_count   INTEGER NOT NULL DEFAULT 0,

  -- Cycle de vie
  status        VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- pending | processing | completed | failed
  started_at    TIMESTAMP WITH TIME ZONE,
  completed_at  TIMESTAMP WITH TIME ZONE,
  duration_ms   INTEGER,

  -- Résultats
  score_avg     NUMERIC(5, 2),
  score_min     NUMERIC(5, 2),
  score_max     NUMERIC(5, 2),
  grade_distribution JSONB,
    -- { "A": 45, "B": 60, "C": 25, "D": 8, "E": 2 }

  -- Erreurs
  error_message TEXT,
  error_details JSONB,

  -- Audit
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ── Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orchestration_runs_status
  ON public.orchestration_runs(status);

CREATE INDEX IF NOT EXISTS idx_orchestration_runs_created_at
  ON public.orchestration_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orchestration_runs_completed_at
  ON public.orchestration_runs(completed_at DESC);

-- ── Audit trigger ──────────────────────────────────────────
-- Auto-sets updated_at, completed_at, duration_ms on UPDATE

CREATE OR REPLACE FUNCTION public.update_orchestration_runs_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = NOW();

  -- Auto-set completed_at when transitioning to completed/failed
  IF NEW.status IN ('completed', 'failed')
     AND OLD.status NOT IN ('completed', 'failed')
     AND NEW.completed_at IS NULL
  THEN
    NEW.completed_at = NOW();
  END IF;

  -- Auto-compute duration_ms
  IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orchestration_runs_audit ON public.orchestration_runs;
CREATE TRIGGER orchestration_runs_audit
  BEFORE UPDATE ON public.orchestration_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_orchestration_runs_audit();

-- ── RLS ────────────────────────────────────────────────────
-- Admin-only read; server-side (service role) writes bypass RLS.

ALTER TABLE public.orchestration_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read orchestration_runs"
  ON public.orchestration_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );
