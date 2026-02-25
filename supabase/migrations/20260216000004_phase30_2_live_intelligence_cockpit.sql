-- PHASE 30.2 — LIVE INTELLIGENCE COCKPIT INTEGRATION
-- Migration: Enhance analytics views with live intelligence metrics
-- Date: 2026-02-16
-- Status: Production-Ready
-- Purpose: Connect Phase 30 live intelligence layer to admin cockpit UI

-- ============================================================================
-- ENHANCED VIEW: analytics_overview_with_intelligence
-- ============================================================================
-- Global metrics enhanced with live intelligence data
-- Adds legal risk scores, doctrine confidence, enrichment status

CREATE OR REPLACE VIEW analytics_overview_with_intelligence AS
SELECT
  -- Basic metrics
  COUNT(DISTINCT ar.id) as total_analyses,
  AVG(ar.total_score) as average_score,
  ROUND(AVG(CAST(ar.percentage AS NUMERIC)), 2) as average_percentage,

  -- Live intelligence metrics
  COUNT(DISTINCT lis.id) as live_enriched_count,
  ROUND(100.0 * COUNT(DISTINCT lis.id) / COUNT(DISTINCT ar.id), 2) as enrichment_rate,
  ROUND(AVG(lis.legal_risk_score), 2) as average_legal_risk_score,
  ROUND(AVG(lis.doctrine_confidence_score), 2) as average_doctrine_confidence_score,

  -- Enterprise verification
  COUNT(DISTINCT CASE WHEN lis.enterprise_verified = TRUE THEN ar.id END) as verified_enterprises_count,
  COUNT(DISTINCT CASE WHEN lis.rge_certified = TRUE THEN ar.id END) as rge_certified_count,

  -- Enrichment status breakdown
  COUNT(CASE WHEN lis.enrichment_status = 'complete' THEN 1 END) as complete_enrichment_count,
  COUNT(CASE WHEN lis.enrichment_status = 'partial' THEN 1 END) as partial_enrichment_count,
  COUNT(CASE WHEN lis.enrichment_status = 'degraded' THEN 1 END) as degraded_enrichment_count

FROM analysis_results ar
LEFT JOIN live_intelligence_snapshots lis ON ar.id = lis.analysis_result_id
WHERE ar.total_score IS NOT NULL
GROUP BY (SELECT 1);

-- ============================================================================
-- VIEW: live_intelligence_status
-- ============================================================================
-- Current live intelligence coverage and verification stats

CREATE OR REPLACE VIEW live_intelligence_status AS
SELECT
  -- Enterprise verification
  (SELECT COUNT(*) FROM enterprise_verifications WHERE status = 'active') as verified_active_enterprises,
  (SELECT COUNT(*) FROM enterprise_verifications WHERE status = 'inactive') as verified_inactive_enterprises,
  (SELECT COUNT(*) FROM enterprise_verifications WHERE status = 'closed') as verified_closed_enterprises,
  (SELECT COUNT(*) FROM enterprise_verifications WHERE status = 'unknown') as verified_unknown_enterprises,

  -- RGE certification
  (SELECT COUNT(*) FROM rge_certifications WHERE certified = TRUE) as rge_certified_contractors,
  (SELECT COUNT(*) FROM rge_certifications WHERE certified = FALSE) as rge_uncertified_contractors,

  -- Geographic context
  (SELECT COUNT(*) FROM geo_context_cache WHERE address_validated = TRUE) as validated_addresses,
  (SELECT AVG(overall_risk_score) FROM geo_context_cache) as average_geo_risk_score,
  (SELECT COUNT(*) FROM geo_context_cache WHERE overall_risk_score > 50) as high_risk_locations,

  -- Doctrine sources
  (SELECT COUNT(*) FROM doctrine_sources) as total_doctrine_sources,
  (SELECT COUNT(*) FROM doctrine_sources WHERE valid_until IS NULL OR valid_until > NOW()) as active_doctrine_sources,

  -- API calls
  (SELECT COUNT(*) FROM api_call_logs WHERE DATE(created_at) = CURRENT_DATE) as api_calls_today,
  (SELECT AVG(response_time_ms) FROM api_call_logs WHERE DATE(created_at) = CURRENT_DATE) as average_api_response_time_ms;

-- ============================================================================
-- VIEW: enterprise_verification_stats
-- ============================================================================
-- Statistics on enterprise verification and RGE certification

CREATE OR REPLACE VIEW enterprise_verification_stats AS
SELECT
  (SELECT COUNT(*) FROM enterprise_verifications) as total_enterprises_verified,
  (SELECT COUNT(DISTINCT siret) FROM rge_certifications) as total_rge_checks,
  (SELECT COUNT(*) FROM rge_certifications WHERE certified = TRUE) as rge_certified_count,
  ROUND(100.0 * (SELECT COUNT(*) FROM rge_certifications WHERE certified = TRUE) /
         NULLIF((SELECT COUNT(*) FROM rge_certifications), 0), 2) as rge_certification_rate,
  (SELECT AVG(verification_score) FROM enterprise_verifications) as average_verification_score,
  (SELECT MAX(last_verified_at) FROM enterprise_verifications) as last_verification_timestamp;

-- ============================================================================
-- VIEW: api_health_stats
-- ============================================================================
-- API integration health and performance metrics

CREATE OR REPLACE VIEW api_health_stats AS
SELECT
  api_name,
  COUNT(*) as total_calls,
  COUNT(CASE WHEN response_code >= 200 AND response_code < 300 THEN 1 END) as successful_calls,
  ROUND(100.0 * COUNT(CASE WHEN response_code >= 200 AND response_code < 300 THEN 1 END) /
        COUNT(*), 2) as success_rate,
  ROUND(AVG(response_time_ms), 2) as average_response_time_ms,
  MAX(response_time_ms) as max_response_time_ms,
  MIN(response_time_ms) as min_response_time_ms,
  MAX(created_at) as last_call_timestamp,
  COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as error_count
FROM api_call_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY api_name
ORDER BY last_call_timestamp DESC;

-- ============================================================================
-- ENHANCED VIEW: doctrine_activation_stats_view
-- ============================================================================
-- Replace placeholder with real doctrine activation metrics

CREATE OR REPLACE VIEW doctrine_activation_stats_view AS
SELECT
  COUNT(DISTINCT ar.id) as total_analyses,
  COUNT(DISTINCT CASE WHEN lis.id IS NOT NULL THEN ar.id END) as doctrine_activated_count,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN lis.id IS NOT NULL THEN ar.id END) /
        COUNT(DISTINCT ar.id), 2) as activation_rate,
  ROUND(AVG(lis.doctrine_confidence_score), 2) as average_confidence_score,
  COUNT(DISTINCT CASE WHEN lis.enrichment_status = 'complete' THEN ar.id END) as complete_enrichment_count,
  COUNT(DISTINCT CASE WHEN lis.enrichment_status = 'partial' THEN ar.id END) as partial_enrichment_count,
  (SELECT MAX(created_at) FROM live_intelligence_snapshots) as last_enrichment_timestamp
FROM analysis_results ar
LEFT JOIN live_intelligence_snapshots lis ON ar.id = lis.analysis_result_id;

-- ============================================================================
-- ENHANCED VIEW: grade_distribution_with_intelligence
-- ============================================================================
-- Grade distribution enhanced with live intelligence enrichment status

CREATE OR REPLACE VIEW grade_distribution_with_intelligence AS
SELECT
  ar.final_grade,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage,
  -- Live intelligence enrichment
  COUNT(CASE WHEN lis.enrichment_status = 'complete' THEN 1 END) as complete_enriched,
  COUNT(CASE WHEN lis.enrichment_status = 'partial' THEN 1 END) as partial_enriched,
  COUNT(CASE WHEN lis.enrichment_status = 'degraded' THEN 1 END) as degraded_enriched,
  COUNT(CASE WHEN lis.id IS NULL THEN 1 END) as not_enriched,
  -- Risk metrics
  ROUND(AVG(lis.legal_risk_score), 2) as average_legal_risk_score,
  ROUND(AVG(lis.doctrine_confidence_score), 2) as average_doctrine_confidence
FROM analysis_results ar
LEFT JOIN live_intelligence_snapshots lis ON ar.id = lis.analysis_result_id
WHERE ar.final_grade IS NOT NULL
GROUP BY ar.final_grade
ORDER BY ar.final_grade;

-- ============================================================================
-- ENHANCED VIEW: fraud_distribution_with_intelligence
-- ============================================================================
-- Fraud distribution showing enterprise verification and geo risk factors

CREATE OR REPLACE VIEW fraud_distribution_with_intelligence AS
SELECT
  ar.fraud_level,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage,
  -- Enterprise verification impact on fraud
  COUNT(CASE WHEN lis.enterprise_verified = FALSE THEN 1 END) as unverified_enterprise_count,
  COUNT(CASE WHEN lis.rge_certified = FALSE THEN 1 END) as uncertified_rge_count,
  -- Geo risk factors
  COUNT(CASE WHEN lis.overall_risk_score > 60 THEN 1 END) as high_geo_risk_count,
  -- Doctrine confidence
  ROUND(AVG(lis.doctrine_confidence_score), 2) as average_doctrine_confidence
FROM analysis_results ar
LEFT JOIN live_intelligence_snapshots lis ON ar.id = lis.analysis_result_id
WHERE ar.fraud_level IS NOT NULL
GROUP BY ar.fraud_level
ORDER BY
  CASE ar.fraud_level
    WHEN 'low' THEN 1
    WHEN 'moderate' THEN 2
    WHEN 'high' THEN 3
    WHEN 'critical' THEN 4
    ELSE 5
  END;

-- ============================================================================
-- ENHANCED VIEW: adaptive_scoring_with_intelligence
-- ============================================================================
-- Adaptive scoring impact with live intelligence enrichment context

CREATE OR REPLACE VIEW adaptive_scoring_with_intelligence AS
SELECT
  COUNT(*) as total_analyses,
  COUNT(CASE WHEN ar.adaptive_multiplier != 1.0 THEN 1 END) as adjusted_analyses,
  ROUND(100.0 * COUNT(CASE WHEN ar.adaptive_multiplier != 1.0 THEN 1 END) / COUNT(*), 2) as adjustment_rate,
  ROUND(AVG(ar.normative_penalty), 4) as average_normative_penalty,
  ROUND(AVG(ar.pricing_penalty), 4) as average_pricing_penalty,
  ROUND(AVG(ar.sector_multiplier), 4) as average_sector_multiplier,
  -- Live intelligence context
  ROUND(AVG(lis.legal_risk_score), 2) as average_legal_risk_score,
  COUNT(DISTINCT CASE WHEN lis.enrichment_status = 'complete' THEN ar.id END) as enriched_adjustments,
  ROUND(AVG(CASE WHEN lis.enterprise_verified = TRUE THEN ar.adaptive_multiplier ELSE NULL END), 4) as average_multiplier_verified_enterprises,
  ROUND(AVG(CASE WHEN lis.enterprise_verified = FALSE THEN ar.adaptive_multiplier ELSE NULL END), 4) as average_multiplier_unverified_enterprises
FROM analysis_results ar
LEFT JOIN live_intelligence_snapshots lis ON ar.id = lis.analysis_result_id;

-- ============================================================================
-- VIEW: engine_execution_with_live_intelligence
-- ============================================================================
-- Engine execution stats including live doctrine activation engine

CREATE OR REPLACE VIEW engine_execution_with_live_intelligence AS
SELECT
  engine_name,
  COUNT(*) as execution_count,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
  ROUND(100.0 * COUNT(CASE WHEN status = 'completed' THEN 1 END) / COUNT(*), 2) as success_rate,
  ROUND(AVG(CAST(execution_time_ms AS NUMERIC)), 2) as average_execution_time_ms,
  MAX(execution_time_ms) as max_execution_time_ms,
  MIN(execution_time_ms) as min_execution_time_ms,
  MAX(timestamp) as last_execution,
  -- For live doctrine activation engine specifically
  CASE
    WHEN engine_name = 'liveDoctrineActivation'
    THEN COALESCE((SELECT COUNT(*) FROM live_intelligence_snapshots WHERE enrichment_status = 'complete'), 0)
    ELSE 0
  END as complete_enrichments,
  CASE
    WHEN engine_name = 'liveDoctrineActivation'
    THEN COALESCE((SELECT COUNT(*) FROM api_call_logs WHERE DATE(created_at) = CURRENT_DATE), 0)
    ELSE 0
  END as api_calls_today
FROM score_snapshots
GROUP BY engine_name
ORDER BY MAX(timestamp) DESC;

-- ============================================================================
-- VIEW: recent_orchestrations_with_intelligence
-- ============================================================================
-- Recent orchestrations enhanced with live intelligence context

CREATE OR REPLACE VIEW recent_orchestrations_with_intelligence AS
SELECT
  ar.id,
  ar.project_id,
  ar.final_grade,
  ar.total_score as adaptive_score,
  ar.fraud_score,
  ar.coherence_score,
  ar.created_at as timestamp,
  EXTRACT(EPOCH FROM (ar.updated_at - ar.created_at))::INTEGER as duration_ms,
  -- Live intelligence context
  COALESCE(lis.enrichment_status, 'none') as enrichment_status,
  COALESCE(lis.legal_risk_score, 0) as legal_risk_score,
  COALESCE(lis.doctrine_confidence_score, 0) as doctrine_confidence_score,
  COALESCE(lis.enterprise_verified, FALSE) as enterprise_verified,
  COALESCE(lis.rge_certified, FALSE) as rge_certified,
  COALESCE(lis.overall_risk_score, 0) as geo_risk_score
FROM analysis_results ar
LEFT JOIN live_intelligence_snapshots lis ON ar.id = lis.analysis_result_id
ORDER BY ar.created_at DESC
LIMIT 100;

-- ============================================================================
-- INDEXES for improved query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_live_intelligence_snapshots_enrichment_status
  ON live_intelligence_snapshots(enrichment_status)
  WHERE enrichment_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_live_intelligence_snapshots_risk_score
  ON live_intelligence_snapshots(legal_risk_score DESC);

CREATE INDEX IF NOT EXISTS idx_enterprise_verifications_status
  ON enterprise_verifications(status)
  WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_api_call_logs_created_at
  ON api_call_logs(created_at DESC, api_name)
  WHERE created_at >= NOW() - INTERVAL '7 days';

CREATE INDEX IF NOT EXISTS idx_analysis_results_with_live_intelligence
  ON analysis_results(id)
  WHERE id IN (SELECT DISTINCT analysis_result_id FROM live_intelligence_snapshots);

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- If needed, run:
--
-- DROP VIEW IF EXISTS recent_orchestrations_with_intelligence;
-- DROP VIEW IF EXISTS engine_execution_with_live_intelligence;
-- DROP VIEW IF EXISTS adaptive_scoring_with_intelligence;
-- DROP VIEW IF EXISTS fraud_distribution_with_intelligence;
-- DROP VIEW IF EXISTS grade_distribution_with_intelligence;
-- DROP VIEW IF EXISTS doctrine_activation_stats_view;
-- DROP VIEW IF EXISTS api_health_stats;
-- DROP VIEW IF EXISTS enterprise_verification_stats;
-- DROP VIEW IF EXISTS live_intelligence_status;
-- DROP VIEW IF EXISTS analytics_overview_with_intelligence;
-- DROP INDEX IF EXISTS idx_analysis_results_with_live_intelligence;
-- DROP INDEX IF EXISTS idx_api_call_logs_created_at;
-- DROP INDEX IF EXISTS idx_enterprise_verifications_status;
-- DROP INDEX IF EXISTS idx_live_intelligence_snapshots_risk_score;
-- DROP INDEX IF EXISTS idx_live_intelligence_snapshots_enrichment_status;
