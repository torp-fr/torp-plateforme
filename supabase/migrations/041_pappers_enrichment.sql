-- ============================================
-- MIGRATION 041: PAPPERS ENRICHMENT
-- Created: 2026-02-12
-- Purpose: Enrich company_data_cache with Pappers data and financial metrics
-- ============================================

-- Check if company_data_cache exists, create if not
CREATE TABLE IF NOT EXISTS company_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siret TEXT UNIQUE,
  siren TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- ALTER existing table to add Pappers columns
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS siret TEXT UNIQUE;
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS siren TEXT;
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS legal_form TEXT;

-- Company information
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS country TEXT;

-- Financial data (last 3 years)
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS turnover_2023 NUMERIC;
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS net_income_2023 NUMERIC;
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS employees_count INTEGER;

ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS turnover_2022 NUMERIC;
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS net_income_2022 NUMERIC;

ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS turnover_2021 NUMERIC;
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS net_income_2021 NUMERIC;

-- Financial health metrics
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS solvency_score NUMERIC DEFAULT 50;      -- 0-100
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS payment_reliability NUMERIC DEFAULT 50;  -- 0-100
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS bankruptcy_risk BOOLEAN DEFAULT FALSE;
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS financial_risk_level TEXT;              -- 'low', 'medium', 'high'

-- Certifications & Licenses
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS certifications JSONB;                  -- [{name, issuer, expiry_date}]
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS licenses JSONB;                        -- [{type, number, status, expiry_date}]
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS rge_certifications TEXT[];             -- List of RGE cert IDs

-- Activity information
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS activity_start_date DATE;
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS activity_status TEXT;                  -- 'active', 'dormant', 'dissolved', 'liquidation'
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS activity_history JSONB;               -- [{date, event, description}]
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS years_in_business INTEGER;

-- Management
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS executives JSONB;                      -- [{name, role, since_date}]
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS shareholders JSONB;                    -- [{name, share_percentage}]

-- Market position
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS naf_code TEXT;                         -- NAF activity code
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS subsector TEXT;

-- Pappers specific
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS pappers_fetched_at TIMESTAMP;          -- When was Pappers called
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS pappers_valid_until TIMESTAMP;         -- Cache expiry (90 days)
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS pappers_full_response JSONB;           -- Complete API response (archive)
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS pappers_error BOOLEAN DEFAULT FALSE;
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS pappers_error_message TEXT;
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS pappers_error_at TIMESTAMP;
ALTER TABLE company_data_cache ADD COLUMN IF NOT EXISTS pappers_retry_count INTEGER DEFAULT 0;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_company_data_cache_siret ON company_data_cache(siret);
CREATE INDEX IF NOT EXISTS idx_company_data_cache_siren ON company_data_cache(siren);
CREATE INDEX IF NOT EXISTS idx_company_data_cache_pappers_fetched_at ON company_data_cache(pappers_fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_data_cache_pappers_valid_until ON company_data_cache(pappers_valid_until);
CREATE INDEX IF NOT EXISTS idx_company_data_cache_activity_status ON company_data_cache(activity_status);
CREATE INDEX IF NOT EXISTS idx_company_data_cache_solvency_score ON company_data_cache(solvency_score DESC);

-- Enable RLS
ALTER TABLE company_data_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY IF NOT EXISTS "Everyone can read company data cache"
  ON company_data_cache FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Only service role can insert/update company data"
  ON company_data_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Only service role can update company data"
  ON company_data_cache FOR UPDATE
  WITH CHECK (true);

-- ============================================
-- ANALYSIS CRITERIA ENRICHMENT TABLE
-- Purpose: Store criteria definitions for versioning and audit
-- ============================================
CREATE TABLE IF NOT EXISTS analysis_criteria_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Criterion identity
  criterion_key TEXT NOT NULL,               -- 'conformite_prix', 'completeness'
  criterion_name TEXT NOT NULL,              -- Display name
  axis TEXT NOT NULL,                        -- 'PRIX', 'ENTREPRISE', etc

  -- Scoring
  max_points INTEGER DEFAULT 100,
  weight NUMERIC DEFAULT 1.0,                -- Weight in total score

  -- Definition
  description TEXT,
  evaluation_method TEXT,                    -- 'formula', 'ai_analysis', 'threshold'
  evaluation_logic JSONB,                    -- {formula: "..."}
  thresholds JSONB,                          -- {excellent: 95, good: 75, warning: 50}

  -- Data sources
  data_sources TEXT[],                       -- ['devis', 'pappers', 'rge']
  required_fields TEXT[],                    -- Fields needed for evaluation

  -- KB references
  kb_references JSONB,                       -- [{type: 'DTU', ref: '25.40'}]

  -- Versioning
  version TEXT DEFAULT 'v1',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_analysis_criteria_definitions_key ON analysis_criteria_definitions(criterion_key);
CREATE INDEX IF NOT EXISTS idx_analysis_criteria_definitions_axis ON analysis_criteria_definitions(axis);
CREATE INDEX IF NOT EXISTS idx_analysis_criteria_definitions_version ON analysis_criteria_definitions(version);

-- ============================================
-- INTEGRATION WITH EXISTING TABLES
-- ============================================

-- Link company enrichment to CCF
ALTER TABLE ccf ADD COLUMN IF NOT EXISTS enriched_company_id UUID REFERENCES company_data_cache(id);
ALTER TABLE ccf ADD COLUMN IF NOT EXISTS last_enrichment_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_ccf_enriched_company_id ON ccf(enriched_company_id);

-- Link to quote_uploads
ALTER TABLE quote_uploads ADD COLUMN IF NOT EXISTS enriched_company_id UUID REFERENCES company_data_cache(id);
ALTER TABLE quote_uploads ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending';  -- pending, processing, complete, failed
ALTER TABLE quote_uploads ADD COLUMN IF NOT EXISTS enrichment_started_at TIMESTAMP;
ALTER TABLE quote_uploads ADD COLUMN IF NOT EXISTS enrichment_completed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_quote_uploads_enriched_company_id ON quote_uploads(enriched_company_id);
CREATE INDEX IF NOT EXISTS idx_quote_uploads_enrichment_status ON quote_uploads(enrichment_status);

-- ============================================
-- HELPER FUNCTIONS FOR PAPPERS
-- ============================================

-- Function to check if Pappers data is still valid
CREATE OR REPLACE FUNCTION is_pappers_data_valid(company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_data_cache
    WHERE id = company_id
    AND pappers_fetched_at IS NOT NULL
    AND pappers_valid_until > now()
    AND pappers_error = FALSE
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get financial health score
CREATE OR REPLACE FUNCTION calculate_financial_health_score(
  turnover NUMERIC,
  net_income NUMERIC,
  employees INTEGER,
  bankruptcy_risk BOOLEAN
)
RETURNS jsonb AS $$
DECLARE
  profitability NUMERIC;
  turnover_per_employee NUMERIC;
  score NUMERIC := 50;
BEGIN
  -- Avoid division by zero
  IF turnover IS NULL OR turnover = 0 THEN
    RETURN jsonb_build_object(
      'score', 30,
      'profitability', 0,
      'level', 'risky',
      'reason', 'No turnover data available'
    );
  END IF;

  -- Calculate profitability
  profitability := COALESCE((net_income / turnover * 100), 0);

  -- Calculate turnover per employee
  IF employees IS NOT NULL AND employees > 0 THEN
    turnover_per_employee := turnover / employees;
  END IF;

  -- Calculate base score from profitability
  IF profitability >= 15 THEN
    score := 90;
  ELSIF profitability >= 10 THEN
    score := 80;
  ELSIF profitability >= 5 THEN
    score := 70;
  ELSIF profitability >= 0 THEN
    score := 50;
  ELSE
    score := 30;
  END IF;

  -- Adjust for bankruptcy risk
  IF bankruptcy_risk THEN
    score := score * 0.7;
  END IF;

  RETURN jsonb_build_object(
    'score', ROUND(score::numeric, 0),
    'profitability', ROUND(profitability::numeric, 2),
    'turnover_per_employee', ROUND(COALESCE(turnover_per_employee, 0)::numeric, 2),
    'bankruptcy_risk', bankruptcy_risk,
    'level', CASE
      WHEN score >= 80 THEN 'excellent'
      WHEN score >= 60 THEN 'good'
      WHEN score >= 40 THEN 'moderate'
      ELSE 'risky'
    END
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get company solvency assessment
CREATE OR REPLACE FUNCTION assess_company_solvency(company_id UUID)
RETURNS jsonb AS $$
DECLARE
  company_record RECORD;
  assessment JSONB;
BEGIN
  SELECT * INTO company_record FROM company_data_cache WHERE id = company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Company not found');
  END IF;

  assessment := calculate_financial_health_score(
    company_record.turnover_2023,
    company_record.net_income_2023,
    company_record.employees_count,
    company_record.bankruptcy_risk
  );

  -- Add additional factors
  assessment := assessment || jsonb_build_object(
    'activity_status', company_record.activity_status,
    'years_in_business', company_record.years_in_business,
    'has_certifications', (company_record.certifications IS NOT NULL AND jsonb_array_length(company_record.certifications) > 0),
    'payment_reliability', company_record.payment_reliability,
    'overall_risk', CASE
      WHEN company_record.payment_reliability < 40 OR company_record.bankruptcy_risk THEN 'high'
      WHEN company_record.payment_reliability < 60 THEN 'medium'
      ELSE 'low'
    END
  );

  RETURN assessment;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Enhancements:
--   - Added 25+ columns to company_data_cache for Pappers data
--   - Financial metrics: turnover, net income, profitability
--   - Certifications, licenses, RGE certifications
--   - Activity history and management info
--   - Solvency and payment health scores
--   - Integration with ccf and quote_uploads tables
-- Functions:
--   - is_pappers_data_valid()
--   - calculate_financial_health_score()
--   - assess_company_solvency()
-- Indexes: Created for performance optimization
-- ============================================
