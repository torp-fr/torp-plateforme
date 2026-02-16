-- PHASE 30.3 — PRODUCTION HARDENING & RESILIENCE LAYER
-- Migration: System Health Status and Resilience Infrastructure
-- Date: 2026-02-16
-- Status: Production-Ready
-- Purpose: Global system health monitoring and resilience tracking

-- ============================================================================
-- TABLE: system_health_status
-- ============================================================================
-- Tracks health status of all services and APIs
-- Used by watchdog and resilience layers for real-time monitoring

CREATE TABLE IF NOT EXISTS system_health_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'down')),
  last_failure_at TIMESTAMP WITH TIME ZONE,
  failure_count INTEGER NOT NULL DEFAULT 0,
  recovery_attempts INTEGER NOT NULL DEFAULT 0,
  last_recovery_at TIMESTAMP WITH TIME ZONE,
  details JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE: api_circuit_breaker_states
-- ============================================================================
-- Tracks circuit breaker state for each API
-- Used by resilience layer to manage API access

CREATE TABLE IF NOT EXISTS api_circuit_breaker_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name VARCHAR(100) NOT NULL UNIQUE,
  state VARCHAR(20) NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half-open')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_failure_at TIMESTAMP WITH TIME ZONE,
  last_success_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  total_failures INTEGER NOT NULL DEFAULT 0,
  total_recoveries INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE: system_alerts
-- ============================================================================
-- Tracks system alerts and warnings from watchdog service
-- Used for admin notification and system monitoring

CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  service_name VARCHAR(100),
  message TEXT NOT NULL,
  details JSONB,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE: cache_performance_metrics
-- ============================================================================
-- Tracks cache hit/miss ratios and performance metrics
-- Used by intelligent cache service monitoring

CREATE TABLE IF NOT EXISTS cache_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_source VARCHAR(100) NOT NULL,
  hit_count BIGINT NOT NULL DEFAULT 0,
  miss_count BIGINT NOT NULL DEFAULT 0,
  total_requests BIGINT NOT NULL DEFAULT 0,
  average_hit_age_ms INTEGER DEFAULT 0,
  average_miss_age_ms INTEGER DEFAULT 0,
  evicted_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- VIEW: api_health_summary
-- ============================================================================
-- Summary of API health status for monitoring

CREATE OR REPLACE VIEW api_health_summary AS
SELECT
  api_name,
  (SELECT status FROM system_health_status WHERE service_name = 'api_' || api_name LIMIT 1) as api_status,
  (SELECT state FROM api_circuit_breaker_states WHERE api_name = api_call_logs.api_name LIMIT 1) as circuit_breaker_state,
  COUNT(*) as total_calls,
  COUNT(CASE WHEN response_code >= 200 AND response_code < 300 THEN 1 END) as successful_calls,
  ROUND(100.0 * COUNT(CASE WHEN response_code >= 200 AND response_code < 300 THEN 1 END) / COUNT(*), 2) as success_rate,
  ROUND(AVG(response_time_ms), 2) as average_response_time_ms,
  MAX(created_at) as last_call_time,
  COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as error_count
FROM api_call_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY api_name;

-- ============================================================================
-- VIEW: system_health_overview
-- ============================================================================
-- Overall system health view

CREATE OR REPLACE VIEW system_health_overview AS
SELECT
  COUNT(*) as total_services,
  COUNT(CASE WHEN status = 'healthy' THEN 1 END) as healthy_services,
  COUNT(CASE WHEN status = 'degraded' THEN 1 END) as degraded_services,
  COUNT(CASE WHEN status = 'down' THEN 1 END) as down_services,
  ROUND(100.0 * COUNT(CASE WHEN status = 'healthy' THEN 1 END) / COUNT(*), 2) as health_percentage,
  COUNT(CASE WHEN last_failure_at IS NOT NULL AND last_failure_at > NOW() - INTERVAL '1 hour' THEN 1 END) as recent_failures_1h,
  COUNT(CASE WHEN last_failure_at IS NOT NULL AND last_failure_at > NOW() - INTERVAL '24 hours' THEN 1 END) as recent_failures_24h,
  MAX(updated_at) as last_update
FROM system_health_status;

-- ============================================================================
-- VIEW: circuit_breaker_status
-- ============================================================================
-- Circuit breaker state monitoring

CREATE OR REPLACE VIEW circuit_breaker_status AS
SELECT
  api_name,
  state,
  failure_count,
  success_count,
  total_failures,
  total_recoveries,
  last_failure_at,
  last_success_at,
  CASE
    WHEN state = 'open' THEN 'API Access Blocked'
    WHEN state = 'half-open' THEN 'Testing API Recovery'
    WHEN state = 'closed' THEN 'API Operational'
    ELSE 'Unknown'
  END as status_description,
  ROUND(
    CASE
      WHEN (total_failures + total_recoveries) = 0 THEN 0
      ELSE 100.0 * total_recoveries / (total_failures + total_recoveries)
    END,
    2
  ) as recovery_rate_percent
FROM api_circuit_breaker_states;

-- ============================================================================
-- VIEW: active_system_alerts
-- ============================================================================
-- Currently active system alerts

CREATE OR REPLACE VIEW active_system_alerts AS
SELECT
  id,
  alert_type,
  severity,
  service_name,
  message,
  details,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER / 60 as age_minutes,
  acknowledged,
  resolved
FROM system_alerts
WHERE resolved = FALSE
ORDER BY created_at DESC;

-- ============================================================================
-- VIEW: cache_performance_summary
-- ============================================================================
-- Cache performance metrics summary

CREATE OR REPLACE VIEW cache_performance_summary AS
SELECT
  cache_source,
  total_requests,
  hit_count,
  miss_count,
  CASE
    WHEN total_requests = 0 THEN 0
    ELSE ROUND(100.0 * hit_count / total_requests, 2)
  END as hit_ratio_percent,
  CASE
    WHEN total_requests = 0 THEN 0
    ELSE ROUND(100.0 * miss_count / total_requests, 2)
  END as miss_ratio_percent,
  average_hit_age_ms,
  average_miss_age_ms,
  evicted_count,
  updated_at
FROM cache_performance_metrics;

-- ============================================================================
-- FUNCTION: update_system_health_status
-- ============================================================================
-- Updates system health status timestamp

CREATE OR REPLACE FUNCTION update_system_health_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER trigger_update_system_health_status
  BEFORE UPDATE ON system_health_status
  FOR EACH ROW
  EXECUTE FUNCTION update_system_health_status();

CREATE TRIGGER trigger_update_circuit_breaker_states
  BEFORE UPDATE ON api_circuit_breaker_states
  FOR EACH ROW
  EXECUTE FUNCTION update_system_health_status();

CREATE TRIGGER trigger_update_system_alerts
  BEFORE UPDATE ON system_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_system_health_status();

CREATE TRIGGER trigger_update_cache_performance
  BEFORE UPDATE ON cache_performance_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_system_health_status();

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_system_health_status_status
  ON system_health_status(status)
  WHERE status != 'healthy';

CREATE INDEX IF NOT EXISTS idx_system_health_status_updated_at
  ON system_health_status(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_circuit_breaker_states_state
  ON api_circuit_breaker_states(state)
  WHERE state != 'closed';

CREATE INDEX IF NOT EXISTS idx_system_alerts_severity
  ON system_alerts(severity DESC)
  WHERE resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at
  ON system_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_alerts_service_name
  ON system_alerts(service_name)
  WHERE resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_cache_performance_metrics_source
  ON cache_performance_metrics(cache_source);

-- ============================================================================
-- Initial Data
-- ============================================================================

-- Initialize health status for known services
INSERT INTO system_health_status (service_name, status) VALUES
  ('api_insee', 'healthy'),
  ('api_rge', 'healthy'),
  ('api_ban', 'healthy'),
  ('api_cadastre', 'healthy'),
  ('api_georisques', 'healthy'),
  ('live_doctrine_engine', 'healthy'),
  ('database', 'healthy')
ON CONFLICT (service_name) DO NOTHING;

-- Initialize circuit breakers for known APIs
INSERT INTO api_circuit_breaker_states (api_name, state) VALUES
  ('insee', 'closed'),
  ('rge', 'closed'),
  ('ban', 'closed'),
  ('cadastre', 'closed'),
  ('georisques', 'closed')
ON CONFLICT (api_name) DO NOTHING;

-- Initialize cache performance metrics
INSERT INTO cache_performance_metrics (cache_source) VALUES
  ('enterprise_verifications'),
  ('geo_context_cache'),
  ('rge_certifications'),
  ('api_response'),
  ('doctrine_sources'),
  ('fraud_patterns')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- RLS POLICIES (Admin-only access to system health)
-- ============================================================================

ALTER TABLE system_health_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_circuit_breaker_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Allow service to update health status (service role)
CREATE POLICY system_health_service_update ON system_health_status
  FOR UPDATE
  USING (auth.role() = 'service')
  WITH CHECK (auth.role() = 'service');

-- Allow admins to read health status
CREATE POLICY system_health_admin_read ON system_health_status
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- If needed, run:
--
-- DROP VIEW IF EXISTS cache_performance_summary;
-- DROP VIEW IF EXISTS active_system_alerts;
-- DROP VIEW IF EXISTS circuit_breaker_status;
-- DROP VIEW IF EXISTS system_health_overview;
-- DROP VIEW IF EXISTS api_health_summary;
-- DROP TRIGGER IF EXISTS trigger_update_cache_performance ON cache_performance_metrics;
-- DROP TRIGGER IF EXISTS trigger_update_system_alerts ON system_alerts;
-- DROP TRIGGER IF EXISTS trigger_update_circuit_breaker_states ON api_circuit_breaker_states;
-- DROP TRIGGER IF EXISTS trigger_update_system_health_status ON system_health_status;
-- DROP FUNCTION IF EXISTS update_system_health_status();
-- DROP TABLE IF EXISTS cache_performance_metrics;
-- DROP TABLE IF EXISTS system_alerts;
-- DROP TABLE IF EXISTS api_circuit_breaker_states;
-- DROP TABLE IF EXISTS system_health_status;
