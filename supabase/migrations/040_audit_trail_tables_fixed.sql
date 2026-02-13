-- ============================================
-- MIGRATION 040: AUDIT TRAIL TABLES (FIXED)
-- Created: 2026-02-12
-- Purpose: Create audit trail tables (RLS policies in migration 043)
-- NOTE: This version has NO policy creation to avoid SQL syntax errors
-- ============================================

-- TABLE 1: api_requests_log
-- Purpose: Log every API request made to the system
-- ============================================
CREATE TABLE IF NOT EXISTS api_requests_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccf_id UUID,
  user_id UUID,

  -- Request identification
  request_id TEXT UNIQUE NOT NULL,
  parent_request_id TEXT,

  -- Request details
  source_ip TEXT,
  endpoint TEXT NOT NULL,
  method TEXT CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE')),
  params JSONB,
  headers JSONB,

  -- Response details
  status_code INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  error_details JSONB,

  -- Timing
  requested_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP,

  -- Metadata
  request_type TEXT,
  version TEXT DEFAULT 'v1'
);

CREATE INDEX IF NOT EXISTS idx_api_requests_log_ccf_id ON api_requests_log(ccf_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_log_user_id ON api_requests_log(user_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_log_requested_at ON api_requests_log(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_requests_log_request_id ON api_requests_log(request_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_log_parent_request_id ON api_requests_log(parent_request_id);

ALTER TABLE api_requests_log ENABLE ROW LEVEL SECURITY;

-- TABLE 2: external_api_calls_log
-- Purpose: Track all external API calls (Pappers, INSEE, RGE, Google Maps, etc)
-- ============================================
CREATE TABLE IF NOT EXISTS external_api_calls_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_request_id UUID REFERENCES api_requests_log(id) ON DELETE CASCADE,

  -- External service details
  external_service TEXT NOT NULL,
  endpoint TEXT,
  method TEXT CHECK (method IN ('GET', 'POST', 'PUT')),

  -- Request sent
  request_payload JSONB,
  request_headers JSONB,

  -- Response received
  response_status INTEGER,
  response_payload JSONB,
  response_time_ms INTEGER,

  -- Error tracking
  error_occurred BOOLEAN DEFAULT FALSE,
  error_code TEXT,
  error_message TEXT,
  error_details JSONB,

  -- Context
  ccf_id UUID,
  context_data JSONB,

  -- Timing
  called_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP,

  -- Metadata
  retry_count INTEGER DEFAULT 0,
  retry_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_external_api_calls_log_service ON external_api_calls_log(external_service);
CREATE INDEX IF NOT EXISTS idx_external_api_calls_log_ccf_id ON external_api_calls_log(ccf_id);
CREATE INDEX IF NOT EXISTS idx_external_api_calls_log_called_at ON external_api_calls_log(called_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_api_calls_log_api_request_id ON external_api_calls_log(api_request_id);

ALTER TABLE external_api_calls_log ENABLE ROW LEVEL SECURITY;

-- TABLE 3: criteria_evaluation_log
-- Purpose: Track each criterion evaluation with input, logic, and results
-- ============================================
CREATE TABLE IF NOT EXISTS criteria_evaluation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_request_id UUID REFERENCES api_requests_log(id) ON DELETE CASCADE,

  -- Criterion identification
  criterion_name TEXT NOT NULL,
  criterion_category TEXT,
  criterion_axis TEXT,

  -- Input data for evaluation
  input_data JSONB,

  -- Evaluation methodology
  evaluation_method TEXT,
  evaluation_logic JSONB,

  -- Results
  score NUMERIC,
  max_score NUMERIC DEFAULT 100,
  percentage NUMERIC,
  grade TEXT,

  -- Justification
  justification TEXT,
  findings TEXT[],
  confidence NUMERIC,

  -- Context
  ccf_id UUID,
  room_id TEXT,

  -- Timing
  evaluated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_criteria_evaluation_log_ccf_id ON criteria_evaluation_log(ccf_id);
CREATE INDEX IF NOT EXISTS idx_criteria_evaluation_log_criterion_name ON criteria_evaluation_log(criterion_name);
CREATE INDEX IF NOT EXISTS idx_criteria_evaluation_log_axis ON criteria_evaluation_log(criterion_axis);
CREATE INDEX IF NOT EXISTS idx_criteria_evaluation_log_evaluated_at ON criteria_evaluation_log(evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_criteria_evaluation_log_api_request_id ON criteria_evaluation_log(api_request_id);

ALTER TABLE criteria_evaluation_log ENABLE ROW LEVEL SECURITY;

-- TABLE 4: execution_context_log
-- Purpose: Store execution context for each analysis (global metadata)
-- ============================================
CREATE TABLE IF NOT EXISTS execution_context_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_request_id UUID REFERENCES api_requests_log(id) ON DELETE CASCADE,

  -- Unique identification
  execution_id TEXT UNIQUE NOT NULL,

  -- Project context
  region TEXT,
  climate_zone TEXT,
  project_type TEXT,
  work_types TEXT[],

  -- Geographic context
  address TEXT,
  coordinates JSONB,
  commune_code TEXT,

  -- Contractor context
  contractor_siret TEXT,
  contractor_name TEXT,
  contractor_solvency_score NUMERIC,

  -- Analysis configuration
  analysis_config JSONB,
  kb_chunks_used TEXT[],
  ai_model TEXT,
  ai_temperature NUMERIC,
  ai_max_tokens INTEGER,

  -- Metadata
  ccf_id UUID,
  user_id UUID,

  -- Timing
  started_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP,
  total_duration_ms INTEGER,

  -- Status
  status TEXT CHECK (status IN ('started', 'running', 'completed', 'failed')),

  version TEXT DEFAULT 'v1'
);

CREATE INDEX IF NOT EXISTS idx_execution_context_log_ccf_id ON execution_context_log(ccf_id);
CREATE INDEX IF NOT EXISTS idx_execution_context_log_execution_id ON execution_context_log(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_context_log_started_at ON execution_context_log(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_context_log_user_id ON execution_context_log(user_id);

ALTER TABLE execution_context_log ENABLE ROW LEVEL SECURITY;

-- TABLE 5: score_snapshots
-- Purpose: Snapshots of scores generated at each analysis
-- ============================================
CREATE TABLE IF NOT EXISTS score_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_context_id UUID REFERENCES execution_context_log(id) ON DELETE CASCADE,

  -- Global scores
  global_score INTEGER,
  grade TEXT,
  percentage NUMERIC,

  -- Breakdown
  scores_by_room JSONB,
  scores_by_criterion JSONB,
  scores_by_axis JSONB,

  -- Detailed feedback
  strengths TEXT[],
  weaknesses TEXT[],
  recommendations TEXT[],

  -- Knowledge base references
  kb_references JSONB,

  -- Context
  ccf_id UUID,

  -- Metadata
  snapshot_type TEXT DEFAULT 'full',
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_snapshots_ccf_id ON score_snapshots(ccf_id);
CREATE INDEX IF NOT EXISTS idx_score_snapshots_execution_context_id ON score_snapshots(execution_context_id);
CREATE INDEX IF NOT EXISTS idx_score_snapshots_created_at ON score_snapshots(created_at DESC);

ALTER TABLE score_snapshots ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get complete execution trace
CREATE OR REPLACE FUNCTION get_execution_trace(execution_uuid TEXT)
RETURNS jsonb AS $$
DECLARE
  context_record RECORD;
  api_request_record RECORD;
  external_calls JSONB;
  criteria_evals JSONB;
  scores JSONB;
BEGIN
  SELECT * INTO context_record FROM execution_context_log WHERE execution_id = execution_uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Execution not found');
  END IF;

  SELECT * INTO api_request_record FROM api_requests_log WHERE id = context_record.api_request_id;

  SELECT jsonb_agg(row_to_json(t)) INTO external_calls
  FROM external_api_calls_log t
  WHERE api_request_id = context_record.api_request_id;

  SELECT jsonb_agg(row_to_json(t)) INTO criteria_evals
  FROM criteria_evaluation_log t
  WHERE api_request_id = context_record.api_request_id;

  SELECT jsonb_agg(row_to_json(t)) INTO scores
  FROM score_snapshots t
  WHERE execution_context_id = context_record.id;

  RETURN jsonb_build_object(
    'execution_context', row_to_json(context_record),
    'api_request', row_to_json(api_request_record),
    'external_api_calls', COALESCE(external_calls, '[]'::jsonb),
    'criteria_evaluations', COALESCE(criteria_evals, '[]'::jsonb),
    'score_snapshots', COALESCE(scores, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables created: 5
--   - api_requests_log
--   - external_api_calls_log
--   - criteria_evaluation_log
--   - execution_context_log
--   - score_snapshots
-- RLS: Enabled on all tables (policies in migration 043)
-- Indexes: Created for performance optimization
-- Helper functions: get_execution_trace
-- ============================================
