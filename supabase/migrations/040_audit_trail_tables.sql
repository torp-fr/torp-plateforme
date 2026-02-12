-- ============================================
-- MIGRATION 040: AUDIT TRAIL TABLES
-- Created: 2026-02-12
-- Purpose: Complete audit trail for all API requests, external calls, criteria evaluation
-- ============================================

-- TABLE 1: api_requests_log
-- Purpose: Log every API request made to the system
-- ============================================
CREATE TABLE IF NOT EXISTS api_requests_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccf_id UUID REFERENCES ccf(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Request identification
  request_id TEXT UNIQUE NOT NULL,           -- UUID for correlation
  parent_request_id TEXT,                    -- For distributed tracing

  -- Request details
  source_ip TEXT,
  endpoint TEXT NOT NULL,                    -- '/api/analyze/quote'
  method TEXT CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE')),
  params JSONB,                              -- Request parameters (sanitized)
  headers JSONB,                             -- Request headers (User-Agent, etc)

  -- Response details
  status_code INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  error_details JSONB,

  -- Timing
  requested_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP,

  -- Metadata
  request_type TEXT,                         -- 'upload', 'analyze', 'export'
  version TEXT DEFAULT 'v1'
);

CREATE INDEX IF NOT EXISTS idx_api_requests_log_ccf_id ON api_requests_log(ccf_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_log_user_id ON api_requests_log(user_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_log_requested_at ON api_requests_log(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_requests_log_request_id ON api_requests_log(request_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_log_parent_request_id ON api_requests_log(parent_request_id);

-- RLS for api_requests_log
ALTER TABLE api_requests_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own API requests"
  ON api_requests_log FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role can insert API requests"
  ON api_requests_log FOR INSERT
  WITH CHECK (true);

-- TABLE 2: external_api_calls_log
-- Purpose: Track all external API calls (Pappers, INSEE, RGE, Google Maps, etc)
-- ============================================
CREATE TABLE IF NOT EXISTS external_api_calls_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_request_id UUID REFERENCES api_requests_log(id) ON DELETE CASCADE,

  -- External service details
  external_service TEXT NOT NULL CHECK (external_service IN ('pappers', 'insee', 'rge', 'google_maps', 'other')),
  endpoint TEXT,                             -- Full API endpoint
  method TEXT CHECK (method IN ('GET', 'POST', 'PUT')),

  -- Request sent
  request_payload JSONB,                     -- What we sent (sanitized)
  request_headers JSONB,                     -- Headers (API keys removed)

  -- Response received
  response_status INTEGER,
  response_payload JSONB,                    -- Full response
  response_time_ms INTEGER,

  -- Error tracking
  error_occurred BOOLEAN DEFAULT FALSE,
  error_code TEXT,
  error_message TEXT,
  error_details JSONB,

  -- Context
  ccf_id UUID REFERENCES ccf(id) ON DELETE CASCADE,
  context_data JSONB,                        -- {siret, company_name, region}

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

CREATE POLICY "Users see external API calls for their CCFs"
  ON external_api_calls_log FOR SELECT
  USING (
    ccf_id IN (SELECT id FROM ccf WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role can insert external API calls"
  ON external_api_calls_log FOR INSERT
  WITH CHECK (true);

-- TABLE 3: criteria_evaluation_log
-- Purpose: Track each criterion evaluation with input, logic, and results
-- ============================================
CREATE TABLE IF NOT EXISTS criteria_evaluation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_request_id UUID REFERENCES api_requests_log(id) ON DELETE CASCADE,

  -- Criterion identification
  criterion_name TEXT NOT NULL,              -- 'conformite_prix', 'completeness'
  criterion_category TEXT,                  -- 'price', 'quality', 'compliance', 'enterprise'
  criterion_axis TEXT,                      -- 'PRIX', 'COMPLETUDE', 'ENTREPRISE', 'CONFORMITE', 'DELAIS'

  -- Input data for evaluation
  input_data JSONB,                          -- {prix_devis: 1500, prix_ref: 1200}

  -- Evaluation methodology
  evaluation_method TEXT,                    -- 'formula', 'ai_analysis', 'threshold', 'weighted'
  evaluation_logic JSONB,                    -- {formula: "prix_devis / prix_ref * 100"}

  -- Results
  score NUMERIC,                             -- Actual score achieved
  max_score NUMERIC DEFAULT 100,
  percentage NUMERIC,                        -- 0-100
  grade TEXT,                                -- 'A', 'B', 'C', 'D', 'F'

  -- Justification
  justification TEXT,                        -- Human readable explanation
  findings TEXT[],                           -- Array of specific findings
  confidence NUMERIC,                        -- 0-100 (confidence in score)

  -- Context
  ccf_id UUID REFERENCES ccf(id) ON DELETE CASCADE,
  room_id TEXT,                              -- If applicable (per room)

  -- Timing
  evaluated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_criteria_evaluation_log_ccf_id ON criteria_evaluation_log(ccf_id);
CREATE INDEX IF NOT EXISTS idx_criteria_evaluation_log_criterion_name ON criteria_evaluation_log(criterion_name);
CREATE INDEX IF NOT EXISTS idx_criteria_evaluation_log_axis ON criteria_evaluation_log(criterion_axis);
CREATE INDEX IF NOT EXISTS idx_criteria_evaluation_log_evaluated_at ON criteria_evaluation_log(evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_criteria_evaluation_log_api_request_id ON criteria_evaluation_log(api_request_id);

ALTER TABLE criteria_evaluation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see criteria evaluations for their CCFs"
  ON criteria_evaluation_log FOR SELECT
  USING (
    ccf_id IN (SELECT id FROM ccf WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role can insert criteria evaluations"
  ON criteria_evaluation_log FOR INSERT
  WITH CHECK (true);

-- TABLE 4: execution_context_log
-- Purpose: Store execution context for each analysis (global metadata)
-- ============================================
CREATE TABLE IF NOT EXISTS execution_context_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_request_id UUID REFERENCES api_requests_log(id) ON DELETE CASCADE,

  -- Unique identification
  execution_id TEXT UNIQUE NOT NULL,         -- UUID for this analysis session

  -- Project context
  region TEXT,
  climate_zone TEXT,
  project_type TEXT,                        -- 'renovation', 'neuf', 'maintenance'
  work_types TEXT[],                        -- ['peinture', 'electrique']

  -- Geographic context
  address TEXT,
  coordinates JSONB,                        -- {lat, lng}
  commune_code TEXT,

  -- Contractor context
  contractor_siret TEXT,
  contractor_name TEXT,
  contractor_solvency_score NUMERIC,

  -- Analysis configuration
  analysis_config JSONB,                    -- Weights, rules, thresholds used
  kb_chunks_used TEXT[],                    -- Which KB chunks were used
  ai_model TEXT,                            -- 'claude-opus', version
  ai_temperature NUMERIC,
  ai_max_tokens INTEGER,

  -- Metadata
  ccf_id UUID REFERENCES ccf(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

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

CREATE POLICY "Users see execution context for their CCFs"
  ON execution_context_log FOR SELECT
  USING (
    ccf_id IN (SELECT id FROM ccf WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role can insert execution context"
  ON execution_context_log FOR INSERT
  WITH CHECK (true);

-- TABLE 5: score_snapshots
-- Purpose: Snapshots of scores generated at each analysis
-- ============================================
CREATE TABLE IF NOT EXISTS score_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_context_id UUID REFERENCES execution_context_log(id) ON DELETE CASCADE,

  -- Global scores
  global_score INTEGER,                     -- 0-1000
  grade TEXT,                               -- 'A', 'B', 'C', 'D', 'F'
  percentage NUMERIC,                       -- 0-100

  -- Breakdown
  scores_by_room JSONB,                     -- {salon: {score: 85, grade: 'A'}, ...}
  scores_by_criterion JSONB,                -- {prix: 75, qualite: 85, ...}
  scores_by_axis JSONB,                     -- {PRIX: 300, ENTREPRISE: 200, ...}

  -- Detailed feedback
  strengths TEXT[],                         -- Strengths detected
  weaknesses TEXT[],                        -- Weaknesses detected
  recommendations TEXT[],                   -- Recommendations

  -- Knowledge base references
  kb_references JSONB,                      -- [{type: 'DTU', ref: '25.40', relevance: 0.95}]

  -- Context
  ccf_id UUID REFERENCES ccf(id) ON DELETE CASCADE,

  -- Metadata
  snapshot_type TEXT DEFAULT 'full',        -- 'full', 'partial', 'updated'
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_snapshots_ccf_id ON score_snapshots(ccf_id);
CREATE INDEX IF NOT EXISTS idx_score_snapshots_execution_context_id ON score_snapshots(execution_context_id);
CREATE INDEX IF NOT EXISTS idx_score_snapshots_created_at ON score_snapshots(created_at DESC);

ALTER TABLE score_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see score snapshots for their CCFs"
  ON score_snapshots FOR SELECT
  USING (
    ccf_id IN (SELECT id FROM ccf WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role can insert score snapshots"
  ON score_snapshots FOR INSERT
  WITH CHECK (true);

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
  -- Get execution context
  SELECT * INTO context_record FROM execution_context_log WHERE execution_id = execution_uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Execution not found');
  END IF;

  -- Get API request
  SELECT * INTO api_request_record FROM api_requests_log WHERE id = context_record.api_request_id;

  -- Get external API calls
  SELECT jsonb_agg(row_to_json(t)) INTO external_calls
  FROM external_api_calls_log t
  WHERE api_request_id = context_record.api_request_id;

  -- Get criteria evaluations
  SELECT jsonb_agg(row_to_json(t)) INTO criteria_evals
  FROM criteria_evaluation_log t
  WHERE api_request_id = context_record.api_request_id;

  -- Get score snapshots
  SELECT jsonb_agg(row_to_json(t)) INTO scores
  FROM score_snapshots t
  WHERE execution_context_id = context_record.id;

  -- Return complete trace
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
-- RLS policies: Enabled for all tables
-- Indexes: Created for performance optimization
-- Helper functions: get_execution_trace
-- ============================================
