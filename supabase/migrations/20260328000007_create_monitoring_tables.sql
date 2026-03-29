-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260328000007_create_monitoring_tables
-- Phase 4 - PROMPT G: API monitoring, cost tracking, fallback cascade
-- ─────────────────────────────────────────────────────────────────────────────

-- ── API Health Metrics ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_health_metrics (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name          TEXT        NOT NULL,
  status            TEXT        NOT NULL CHECK (status IN ('online', 'degraded', 'down', 'unknown')),
  response_time_ms  INT,
  error_rate        FLOAT,
  error_message     TEXT,
  checked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_health_metrics_api_name   ON api_health_metrics(api_name);
CREATE INDEX idx_api_health_metrics_checked_at ON api_health_metrics(checked_at DESC);
CREATE INDEX idx_api_health_metrics_status      ON api_health_metrics(api_name, status, checked_at DESC);

ALTER TABLE api_health_metrics ENABLE ROW LEVEL SECURITY;

-- Service role writes (monitor), authenticated admins read
CREATE POLICY "service_role_all_api_health_metrics"
  ON api_health_metrics FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ── API Costs ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_costs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name     TEXT        NOT NULL,
  cost_usd     FLOAT       NOT NULL DEFAULT 0,
  metrics      JSONB,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_costs_api_name    ON api_costs(api_name);
CREATE INDEX idx_api_costs_recorded_at ON api_costs(recorded_at DESC);
CREATE INDEX idx_api_costs_api_date    ON api_costs(api_name, recorded_at DESC);

ALTER TABLE api_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_api_costs"
  ON api_costs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ── API Pricing Configuration ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_pricing_config (
  api_name                  TEXT        PRIMARY KEY,
  price_per_1k_tokens_usd   FLOAT,
  price_per_image_usd        FLOAT,
  price_per_request_usd      FLOAT,
  currency                   TEXT        NOT NULL DEFAULT 'USD',
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE api_pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_api_pricing_config"
  ON api_pricing_config FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Seed default pricing for known APIs
INSERT INTO api_pricing_config (api_name, price_per_1k_tokens_usd, currency) VALUES
  ('claude-haiku',   0.00025, 'USD'),
  ('claude-sonnet',  0.003,   'USD'),
  ('claude-opus',    0.015,   'USD'),
  ('gpt-4o',         0.005,   'USD'),
  ('gpt-4o-mini',    0.00015, 'USD'),
  ('text-embedding-3-small', 0.00002, 'USD')
ON CONFLICT (api_name) DO NOTHING;

-- ── Fallback Cascade Queue ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pipeline_fallback_queue (
  id              TEXT        PRIMARY KEY,
  entity_id       TEXT,
  entity_type     TEXT,
  cascade_layers  TEXT[]      NOT NULL DEFAULT '{}',
  timeline        JSONB       NOT NULL DEFAULT '[]',
  retry_count     INT         NOT NULL DEFAULT 0,
  next_retry_at   TIMESTAMPTZ,
  status          TEXT        NOT NULL DEFAULT 'queued'
                              CHECK (status IN ('queued', 'retrying', 'resolved')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_fallback_queue_status    ON pipeline_fallback_queue(status);
CREATE INDEX idx_pipeline_fallback_queue_created   ON pipeline_fallback_queue(created_at DESC);
CREATE INDEX idx_pipeline_fallback_queue_entity    ON pipeline_fallback_queue(entity_type, entity_id);

ALTER TABLE pipeline_fallback_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_pipeline_fallback_queue"
  ON pipeline_fallback_queue FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ── Refresh Config (optional persistence) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS refresh_configs (
  monitor_id    TEXT        PRIMARY KEY,
  interval_ms   INT         NOT NULL DEFAULT 30000,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  last_refresh  TIMESTAMPTZ,
  next_refresh  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE refresh_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_refresh_configs"
  ON refresh_configs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE api_health_metrics     IS 'Time-series health check results for external APIs (written by APIHealthMonitor)';
COMMENT ON TABLE api_costs              IS 'Per-call cost records for external APIs (written by CostTracker)';
COMMENT ON TABLE api_pricing_config     IS 'Pricing configuration per API (USD rates, updated by admin)';
COMMENT ON TABLE pipeline_fallback_queue IS 'Dead-letter queue for requests where all cascade layers failed';
COMMENT ON TABLE refresh_configs        IS 'Persisted refresh interval settings for admin dashboard sections';
