-- ============================================
-- MIGRATION 044: AUDIT TABLES FINALIZATION
-- Created: 2026-02-12
-- Purpose: Links, analysis results, and helper tables
-- ============================================

-- ============================================
-- LINK QUOTE_UPLOADS TO AUDIT TRAIL
-- ============================================

ALTER TABLE quote_uploads ADD COLUMN IF NOT EXISTS api_request_id UUID REFERENCES api_requests_log(id);
ALTER TABLE quote_uploads ADD COLUMN IF NOT EXISTS execution_context_id UUID REFERENCES execution_context_log(id);

CREATE INDEX IF NOT EXISTS idx_quote_uploads_api_request_id ON quote_uploads(api_request_id);
CREATE INDEX IF NOT EXISTS idx_quote_uploads_execution_context_id ON quote_uploads(execution_context_id);

-- ============================================
-- LINK DEVIS TO AUDIT TRAIL
-- ============================================

ALTER TABLE devis ADD COLUMN IF NOT EXISTS api_request_id UUID REFERENCES api_requests_log(id);
ALTER TABLE devis ADD COLUMN IF NOT EXISTS execution_context_id UUID REFERENCES execution_context_log(id);

CREATE INDEX IF NOT EXISTS idx_devis_api_request_id ON devis(api_request_id);
CREATE INDEX IF NOT EXISTS idx_devis_execution_context_id ON devis(execution_context_id);

-- ============================================
-- AUDIT EVENTS TABLE (Optional: for system events)
-- ============================================

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event details
  event_type TEXT NOT NULL,
  event_category TEXT,
  severity TEXT DEFAULT 'info',

  -- What happened
  description TEXT,
  changes JSONB,

  -- Who & where
  user_id UUID,
  ccf_id UUID,
  api_request_id UUID REFERENCES api_requests_log(id),

  -- Timing
  occurred_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_ccf_id ON audit_events(ccf_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_occurred_at ON audit_events(occurred_at DESC);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ANALYSIS RESULTS TABLE (Aggregated)
-- Purpose: Store final analysis results (summary of all criteria)
-- ============================================

CREATE TABLE IF NOT EXISTS analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  ccf_id UUID NOT NULL,
  quote_upload_id UUID REFERENCES quote_uploads(id) ON DELETE CASCADE,
  execution_context_id UUID REFERENCES execution_context_log(id),
  api_request_id UUID REFERENCES api_requests_log(id),

  -- Global scores
  total_score INTEGER,
  final_grade TEXT,
  percentage NUMERIC,

  -- Scores by axis
  enterprise_score INTEGER,
  enterprise_grade TEXT,

  price_score INTEGER,
  price_grade TEXT,

  completeness_score INTEGER,
  completeness_grade TEXT,

  conformity_score INTEGER,
  conformity_grade TEXT,

  delays_score INTEGER,
  delays_grade TEXT,

  -- Detailed results
  summary TEXT,
  strengths TEXT[],
  weaknesses TEXT[],
  recommendations TEXT[],

  -- References used
  kb_references JSONB,
  criteria_used TEXT[],
  data_sources TEXT[],

  -- Metadata
  analysis_type TEXT DEFAULT 'full',
  ai_model TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_results_ccf_id ON analysis_results(ccf_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_quote_upload_id ON analysis_results(quote_upload_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_execution_context_id ON analysis_results(execution_context_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_created_at ON analysis_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_results_total_score ON analysis_results(total_score DESC);

ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER VIEW: Complete Analysis Report
-- ============================================

CREATE OR REPLACE VIEW complete_analysis_report AS
SELECT
  ar.id as analysis_id,
  ar.ccf_id,
  ar.total_score,
  ar.final_grade,
  ar.percentage,
  ar.created_at as analysis_date,

  -- Axis scores
  ar.enterprise_score,
  ar.price_score,
  ar.completeness_score,
  ar.conformity_score,
  ar.delays_score,

  -- Contractor info
  cdc.company_name as contractor_name,
  cdc.siret,
  cdc.solvency_score,
  cdc.payment_reliability,

  -- Execution details
  ecl.region,
  ecl.project_type,
  ecl.work_types,
  ecl.total_duration_ms,

  -- Summary
  ar.summary,
  ar.recommendations
FROM analysis_results ar
LEFT JOIN company_data_cache cdc ON ar.quote_upload_id IN (
  SELECT id FROM quote_uploads WHERE enriched_company_id = cdc.id
)
LEFT JOIN execution_context_log ecl ON ar.execution_context_id = ecl.id
ORDER BY ar.created_at DESC;

-- ============================================
-- HELPER FUNCTIONS FOR ANALYTICS
-- ============================================

-- Function to get analysis history for a CCF
CREATE OR REPLACE FUNCTION get_ccf_analysis_history(ccf_uuid UUID, limit_count INT DEFAULT 10)
RETURNS TABLE (
  analysis_id UUID,
  analysis_date TIMESTAMP,
  total_score INTEGER,
  final_grade TEXT,
  contractor_name TEXT,
  summary TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.id,
    ar.created_at,
    ar.total_score,
    ar.final_grade,
    cdc.company_name,
    ar.summary
  FROM analysis_results ar
  LEFT JOIN quote_uploads qu ON ar.quote_upload_id = qu.id
  LEFT JOIN company_data_cache cdc ON qu.enriched_company_id = cdc.id
  WHERE ar.ccf_id = ccf_uuid
  ORDER BY ar.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get API call timeline for an analysis
CREATE OR REPLACE FUNCTION get_analysis_api_calls(api_request_uuid UUID)
RETURNS TABLE (
  call_order BIGINT,
  service TEXT,
  endpoint TEXT,
  called_at TIMESTAMP,
  response_time_ms INTEGER,
  status_code INTEGER,
  error_occurred BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY eacl.called_at),
    eacl.external_service,
    eacl.endpoint,
    eacl.called_at,
    eacl.response_time_ms,
    eacl.response_status,
    eacl.error_occurred
  FROM external_api_calls_log eacl
  WHERE eacl.api_request_id = api_request_uuid
  ORDER BY eacl.called_at;
END;
$$ LANGUAGE plpgsql;

-- Function to get criteria breakdown for analysis
CREATE OR REPLACE FUNCTION get_analysis_criteria_breakdown(api_request_uuid UUID)
RETURNS TABLE (
  axis TEXT,
  criterion_name TEXT,
  score NUMERIC,
  max_score NUMERIC,
  percentage NUMERIC,
  grade TEXT,
  justification TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cel.criterion_axis,
    cel.criterion_name,
    cel.score,
    cel.max_score,
    cel.percentage,
    cel.grade,
    cel.justification
  FROM criteria_evaluation_log cel
  WHERE cel.api_request_id = api_request_uuid
  ORDER BY cel.criterion_axis, cel.criterion_name;
END;
$$ LANGUAGE plpgsql;

-- Function to get execution summary
CREATE OR REPLACE FUNCTION get_execution_summary(execution_uuid TEXT)
RETURNS jsonb AS $$
DECLARE
  exec_record RECORD;
  api_call_count INT;
  criteria_eval_count INT;
  avg_api_response_time INT;
BEGIN
  SELECT * INTO exec_record FROM execution_context_log WHERE execution_id = execution_uuid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Execution not found');
  END IF;

  SELECT COUNT(*) INTO api_call_count FROM external_api_calls_log
  WHERE api_request_id = exec_record.api_request_id;

  SELECT COUNT(*) INTO criteria_eval_count FROM criteria_evaluation_log
  WHERE api_request_id = exec_record.api_request_id;

  SELECT AVG(response_time_ms) INTO avg_api_response_time FROM external_api_calls_log
  WHERE api_request_id = exec_record.api_request_id;

  RETURN jsonb_build_object(
    'execution_id', exec_record.execution_id,
    'status', exec_record.status,
    'started_at', exec_record.started_at,
    'completed_at', exec_record.completed_at,
    'total_duration_ms', exec_record.total_duration_ms,
    'region', exec_record.region,
    'project_type', exec_record.project_type,
    'api_calls_made', api_call_count,
    'avg_api_response_time_ms', ROUND(COALESCE(avg_api_response_time, 0)::numeric, 0),
    'criteria_evaluated', criteria_eval_count,
    'contractor_solvency_score', exec_record.contractor_solvency_score
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT SELECT ON get_ccf_analysis_history TO authenticated, anon;
GRANT SELECT ON get_analysis_api_calls TO authenticated, anon;
GRANT SELECT ON get_analysis_criteria_breakdown TO authenticated, anon;
GRANT SELECT ON get_execution_summary TO authenticated, anon;

GRANT EXECUTE ON FUNCTION get_execution_trace(TEXT) TO authenticated, anon;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables created:
--   - audit_events
--   - analysis_results
-- Views created:
--   - complete_analysis_report
-- Functions created:
--   - get_ccf_analysis_history
--   - get_analysis_api_calls
--   - get_analysis_criteria_breakdown
--   - get_execution_summary
-- Permissions: Granted to authenticated and anon users
-- ============================================
