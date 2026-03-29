-- ─────────────────────────────────────────────────────────────────────────────
-- 20260328000005 — pipeline_metrics + pipeline_dead_letters
-- Used by BasePipeline.emitMetrics() (fire-and-forget) and DLQ pattern
-- ─────────────────────────────────────────────────────────────────────────────

-- ── pipeline_metrics ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pipeline_metrics (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_name    text          NOT NULL,
  status           text          NOT NULL CHECK (status IN ('success', 'failure')),
  duration_ms      integer       NOT NULL,
  attempt_number   integer       NOT NULL DEFAULT 1,
  error_message    text,
  created_at       timestamptz   NOT NULL DEFAULT now()
);

-- Index for aggregation queries (dashboard, alerting)
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_name_created
  ON pipeline_metrics (pipeline_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_status
  ON pipeline_metrics (status, created_at DESC);

-- RLS: service role only (metrics are internal observability data)
ALTER TABLE pipeline_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage pipeline_metrics"
  ON pipeline_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── pipeline_dead_letters ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pipeline_dead_letters (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_name  text          NOT NULL,
  job_id         uuid,
  resource_id    text,
  resource_type  text,
  payload        jsonb,
  failure_reason text          NOT NULL,
  attempt_count  integer       NOT NULL DEFAULT 1,
  last_error     text,
  resolved       boolean       NOT NULL DEFAULT false,
  resolved_at    timestamptz,
  resolved_by    text,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now()
);

-- Index for DLQ processing
CREATE INDEX IF NOT EXISTS idx_pipeline_dlq_unresolved
  ON pipeline_dead_letters (resolved, created_at DESC)
  WHERE resolved = false;

CREATE INDEX IF NOT EXISTS idx_pipeline_dlq_pipeline_name
  ON pipeline_dead_letters (pipeline_name, created_at DESC);

ALTER TABLE pipeline_dead_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage pipeline_dead_letters"
  ON pipeline_dead_letters
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_pipeline_dlq_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pipeline_dlq_updated_at
  BEFORE UPDATE ON pipeline_dead_letters
  FOR EACH ROW EXECUTE FUNCTION update_pipeline_dlq_updated_at();

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE pipeline_metrics IS
  'Fire-and-forget execution metrics emitted by BasePipeline.emitMetrics(). '
  'Used for performance dashboards and anomaly alerting.';

COMMENT ON TABLE pipeline_dead_letters IS
  'Items that exhausted all retry attempts in the orchestration layer. '
  'Requires manual review or automated re-queue via pnpm fix:pipeline.';
