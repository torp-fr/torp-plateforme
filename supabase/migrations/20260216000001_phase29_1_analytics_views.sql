-- PHASE 29.1 — ADMIN UX REFACTOR & ORCHESTRATION COCKPIT
-- Migration: Analytics Views for Dashboard
-- Date: 2026-02-16
-- Status: Production-Ready
-- Note: Read-only views - no data modification, pure aggregation

-- ============================================================================
-- VIEW: analytics_overview
-- ============================================================================
-- Global metrics for admin dashboard
-- Shows total analyses, average scores, grade distribution

CREATE OR REPLACE VIEW analytics_overview AS
SELECT
  COUNT(DISTINCT id) as total_analyses,
  AVG(total_score) as average_score,
  ROUND(AVG(CAST(percentage AS NUMERIC)), 2) as average_percentage,
  MIN(total_score) as min_score,
  MAX(total_score) as max_score,
  STDDEV(total_score) as score_stddev
FROM analysis_results
WHERE total_score IS NOT NULL;

-- ============================================================================
-- VIEW: grade_distribution_view
-- ============================================================================
-- Shows breakdown of analyses by final grade

CREATE OR REPLACE VIEW grade_distribution_view AS
SELECT
  final_grade,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM analysis_results
WHERE final_grade IS NOT NULL
GROUP BY final_grade
ORDER BY final_grade;

-- ============================================================================
-- VIEW: fraud_distribution_view
-- ============================================================================
-- Shows breakdown of fraud detection levels

CREATE OR REPLACE VIEW fraud_distribution_view AS
SELECT
  fraud_level,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM analysis_results
WHERE fraud_level IS NOT NULL
GROUP BY fraud_level
ORDER BY
  CASE fraud_level
    WHEN 'low' THEN 1
    WHEN 'moderate' THEN 2
    WHEN 'high' THEN 3
    WHEN 'critical' THEN 4
    ELSE 5
  END;

-- ============================================================================
-- VIEW: recent_orchestrations_view
-- ============================================================================
-- Shows recent orchestration executions with key metrics

CREATE OR REPLACE VIEW recent_orchestrations_view AS
SELECT
  ar.id,
  ar.project_id,
  ar.final_grade,
  ar.total_score as adaptive_score,
  ar.fraud_score,
  ar.coherence_score,
  ar.created_at as timestamp,
  EXTRACT(EPOCH FROM (ar.updated_at - ar.created_at))::INTEGER as duration_ms
FROM analysis_results ar
ORDER BY ar.created_at DESC
LIMIT 100;

-- ============================================================================
-- VIEW: knowledge_base_stats_view
-- ============================================================================
-- Shows knowledge base health metrics

CREATE OR REPLACE VIEW knowledge_base_stats_view AS
SELECT
  (SELECT COUNT(*) FROM knowledge_documents) as total_documents,
  (SELECT COUNT(*) FROM knowledge_chunks) as total_chunks,
  (SELECT SUM(file_size) FROM knowledge_documents) as total_size_bytes,
  (SELECT AVG(chunk_count) FROM knowledge_documents) as avg_chunks_per_document,
  (SELECT MAX(created_at) FROM knowledge_documents) as latest_document_ingested
FROM (SELECT 1) as dummy;

-- ============================================================================
-- VIEW: doctrine_activation_stats_view
-- ============================================================================
-- Shows doctrine activation metrics (requires doctrineInsights in context)
-- This is a placeholder view for Phase 30 integration

CREATE OR REPLACE VIEW doctrine_activation_stats_view AS
SELECT
  COUNT(*) as total_analyses,
  0 as doctrine_activated_count,
  0.0 as activation_rate,
  0.0 as average_confidence_score
FROM analysis_results
LIMIT 1;

-- ============================================================================
-- VIEW: engine_execution_stats_view
-- ============================================================================
-- Shows engine execution statistics from score_snapshots

CREATE OR REPLACE VIEW engine_execution_stats_view AS
SELECT
  engine_name,
  COUNT(*) as execution_count,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
  ROUND(100.0 * COUNT(CASE WHEN status = 'completed' THEN 1 END) / COUNT(*), 2) as success_rate,
  ROUND(AVG(CAST(execution_time_ms AS NUMERIC)), 2) as average_execution_time_ms,
  MAX(execution_time_ms) as max_execution_time_ms,
  MIN(execution_time_ms) as min_execution_time_ms,
  MAX(timestamp) as last_execution
FROM score_snapshots
GROUP BY engine_name
ORDER BY MAX(timestamp) DESC;

-- ============================================================================
-- VIEW: adaptive_scoring_impact_view
-- ============================================================================
-- Shows adaptive scoring impact metrics

CREATE OR REPLACE VIEW adaptive_scoring_impact_view AS
SELECT
  COUNT(*) as total_analyses,
  COUNT(CASE WHEN adaptive_multiplier != 1.0 THEN 1 END) as adjusted_analyses,
  ROUND(100.0 * COUNT(CASE WHEN adaptive_multiplier != 1.0 THEN 1 END) / COUNT(*), 2) as adjustment_rate,
  ROUND(AVG(normative_penalty), 4) as average_normative_penalty,
  ROUND(AVG(pricing_penalty), 4) as average_pricing_penalty,
  ROUND(AVG(sector_multiplier), 4) as average_sector_multiplier
FROM analysis_results;

-- ============================================================================
-- VIEW: user_analysis_summary_view
-- ============================================================================
-- Shows summary of analyses by user

CREATE OR REPLACE VIEW user_analysis_summary_view AS
SELECT
  ar.user_id,
  u.email,
  COUNT(ar.id) as total_analyses,
  COUNT(CASE WHEN ar.final_grade IN ('A', 'B') THEN 1 END) as passing_analyses,
  ROUND(AVG(ar.total_score), 2) as average_score,
  MAX(ar.created_at) as last_analysis_date
FROM analysis_results ar
JOIN auth.users u ON ar.user_id = u.id
GROUP BY ar.user_id, u.email
ORDER BY COUNT(ar.id) DESC;

-- ============================================================================
-- VIEW: hourly_analysis_stats_view
-- ============================================================================
-- Shows analysis volume by hour for trending

CREATE OR REPLACE VIEW hourly_analysis_stats_view AS
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as analysis_count,
  ROUND(AVG(total_score), 2) as average_score,
  COUNT(CASE WHEN fraud_score > 50 THEN 1 END) as high_fraud_count
FROM analysis_results
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- ============================================================================
-- VIEW: sector_performance_view
-- ============================================================================
-- Shows performance by project sector/industry

CREATE OR REPLACE VIEW sector_performance_view AS
SELECT
  sector,
  COUNT(*) as total_analyses,
  ROUND(AVG(total_score), 2) as average_score,
  COUNT(CASE WHEN final_grade = 'A' THEN 1 END) as grade_a_count,
  COUNT(CASE WHEN final_grade = 'B' THEN 1 END) as grade_b_count,
  COUNT(CASE WHEN final_grade = 'C' THEN 1 END) as grade_c_count,
  COUNT(CASE WHEN final_grade = 'D' THEN 1 END) as grade_d_count,
  COUNT(CASE WHEN final_grade = 'E' THEN 1 END) as grade_e_count
FROM analysis_results
WHERE sector IS NOT NULL
GROUP BY sector
ORDER BY COUNT(*) DESC;

-- ============================================================================
-- Indexes for better performance
-- ============================================================================

-- Index for frequent view queries
CREATE INDEX IF NOT EXISTS idx_analysis_results_created_at
  ON analysis_results(created_at DESC)
  WHERE total_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_results_fraud_level
  ON analysis_results(fraud_level)
  WHERE fraud_level IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_results_final_grade
  ON analysis_results(final_grade)
  WHERE final_grade IS NOT NULL;

-- Index for score snapshots queries
CREATE INDEX IF NOT EXISTS idx_score_snapshots_engine_name
  ON score_snapshots(engine_name, timestamp DESC);

-- ============================================================================
-- Rollback Instructions
-- ============================================================================
-- If needed, run:
--
-- DROP VIEW IF EXISTS user_analysis_summary_view;
-- DROP VIEW IF EXISTS hourly_analysis_stats_view;
-- DROP VIEW IF EXISTS sector_performance_view;
-- DROP VIEW IF EXISTS engine_execution_stats_view;
-- DROP VIEW IF EXISTS adaptive_scoring_impact_view;
-- DROP VIEW IF EXISTS knowledge_base_stats_view;
-- DROP VIEW IF EXISTS doctrine_activation_stats_view;
-- DROP VIEW IF EXISTS recent_orchestrations_view;
-- DROP VIEW IF EXISTS fraud_distribution_view;
-- DROP VIEW IF EXISTS grade_distribution_view;
-- DROP VIEW IF EXISTS analytics_overview;
