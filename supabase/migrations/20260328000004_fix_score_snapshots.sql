-- ============================================================
-- Migration: fix score_snapshots — add snapshot_type
-- Phase 3B — Engine endpoints backend
-- Required for Realtime subscription filter: snapshot_type=eq.engine_execution
-- ============================================================

ALTER TABLE public.score_snapshots
ADD COLUMN IF NOT EXISTS snapshot_type VARCHAR(50) DEFAULT 'engine_execution';

-- Composite index for Realtime filter pattern
CREATE INDEX IF NOT EXISTS idx_score_snapshots_type_created
  ON public.score_snapshots(snapshot_type, created_at DESC);

COMMENT ON COLUMN public.score_snapshots.snapshot_type IS
  'Type de snapshot pour les filtres Realtime: engine_execution | aggregated | realtime';
