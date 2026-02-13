-- ============================================
-- MIGRATION 043: FIX RLS POLICIES
-- Created: 2026-02-12
-- Purpose: Fix SQL syntax errors in migrations 040-042
-- ============================================

-- DROP old policies with IF NOT EXISTS (which don't work)
-- and recreate them properly

-- ============================================
-- FIX POLICIES FOR api_requests_log
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users see their own API requests" ON api_requests_log;
DROP POLICY IF EXISTS "Service role can insert API requests" ON api_requests_log;
DROP POLICY IF EXISTS "Admins see all API requests" ON api_requests_log;

-- Recreate with proper syntax
CREATE POLICY "Users see their own API requests"
  ON api_requests_log FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY "Service role can insert API requests"
  ON api_requests_log FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- FIX POLICIES FOR external_api_calls_log
-- ============================================

DROP POLICY IF EXISTS "Users see external API calls for their CCFs" ON external_api_calls_log;
DROP POLICY IF EXISTS "Service role can insert external API calls" ON external_api_calls_log;
DROP POLICY IF EXISTS "Admins see all external API calls" ON external_api_calls_log;

CREATE POLICY "Users see external API calls for their CCFs"
  ON external_api_calls_log FOR SELECT
  USING (
    ccf_id IN (SELECT id FROM ccf WHERE user_id = auth.uid())
    OR auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY "Service role can insert external API calls"
  ON external_api_calls_log FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- FIX POLICIES FOR criteria_evaluation_log
-- ============================================

DROP POLICY IF EXISTS "Users see criteria evaluations for their CCFs" ON criteria_evaluation_log;
DROP POLICY IF EXISTS "Service role can insert criteria evaluations" ON criteria_evaluation_log;
DROP POLICY IF EXISTS "Admins see all criteria evaluations" ON criteria_evaluation_log;

CREATE POLICY "Users see criteria evaluations for their CCFs"
  ON criteria_evaluation_log FOR SELECT
  USING (
    ccf_id IN (SELECT id FROM ccf WHERE user_id = auth.uid())
    OR auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY "Service role can insert criteria evaluations"
  ON criteria_evaluation_log FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- FIX POLICIES FOR execution_context_log
-- ============================================

DROP POLICY IF EXISTS "Users see execution context for their CCFs" ON execution_context_log;
DROP POLICY IF EXISTS "Service role can insert execution context" ON execution_context_log;
DROP POLICY IF EXISTS "Admins see all execution contexts" ON execution_context_log;

CREATE POLICY "Users see execution context for their CCFs"
  ON execution_context_log FOR SELECT
  USING (
    ccf_id IN (SELECT id FROM ccf WHERE user_id = auth.uid())
    OR auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY "Service role can insert execution context"
  ON execution_context_log FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- FIX POLICIES FOR score_snapshots
-- ============================================

DROP POLICY IF EXISTS "Users see score snapshots for their CCFs" ON score_snapshots;
DROP POLICY IF EXISTS "Service role can insert score snapshots" ON score_snapshots;
DROP POLICY IF EXISTS "Admins see all score snapshots" ON score_snapshots;

CREATE POLICY "Users see score snapshots for their CCFs"
  ON score_snapshots FOR SELECT
  USING (
    ccf_id IN (SELECT id FROM ccf WHERE user_id = auth.uid())
    OR auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY "Service role can insert score snapshots"
  ON score_snapshots FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- FIX POLICIES FOR company_data_cache
-- ============================================

DROP POLICY IF EXISTS "Everyone can read company data cache" ON company_data_cache;
DROP POLICY IF EXISTS "Only service role can insert/update company data" ON company_data_cache;
DROP POLICY IF EXISTS "Only service role can update company data" ON company_data_cache;

CREATE POLICY "Everyone can read company data cache"
  ON company_data_cache FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert company data"
  ON company_data_cache FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can update company data"
  ON company_data_cache FOR UPDATE
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- FIX POLICIES FOR analysis_results
-- ============================================

DROP POLICY IF EXISTS "Users see analysis results for their CCFs" ON analysis_results;
DROP POLICY IF EXISTS "Service role can insert analysis results" ON analysis_results;

CREATE POLICY "Users see analysis results for their CCFs"
  ON analysis_results FOR SELECT
  USING (
    ccf_id IN (SELECT id FROM ccf WHERE user_id = auth.uid())
    OR auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY "Service role can insert analysis results"
  ON analysis_results FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Fixed:
--   ✓ Removed invalid "IF NOT EXISTS" from CREATE POLICY
--   ✓ Updated RLS to use service_role checks instead of profiles table
--   ✓ Added proper DROP POLICY IF EXISTS statements
-- ============================================
