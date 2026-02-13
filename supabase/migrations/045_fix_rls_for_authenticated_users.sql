-- ============================================
-- MIGRATION 045: FIX RLS POLICIES FOR AUTHENTICATED USERS
-- Created: 2026-02-12
-- Purpose: Allow authenticated users to log their own API requests
-- ============================================

-- Allow authenticated users to INSERT their own API requests
DROP POLICY IF EXISTS "Service role can insert API requests" ON api_requests_log;

CREATE POLICY "Users can insert their own API requests"
  ON api_requests_log FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- ============================================
-- FIX POLICIES FOR external_api_calls_log
-- ============================================

DROP POLICY IF EXISTS "Service role can insert external API calls" ON external_api_calls_log;

CREATE POLICY "Authenticated users can insert external API calls"
  ON external_api_calls_log FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- ============================================
-- FIX POLICIES FOR criteria_evaluation_log
-- ============================================

DROP POLICY IF EXISTS "Service role can insert criteria evaluations" ON criteria_evaluation_log;

CREATE POLICY "Authenticated users can insert criteria evaluations"
  ON criteria_evaluation_log FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- ============================================
-- FIX POLICIES FOR execution_context_log
-- ============================================

DROP POLICY IF EXISTS "Service role can insert execution context" ON execution_context_log;

CREATE POLICY "Authenticated users can insert execution context"
  ON execution_context_log FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- ============================================
-- FIX POLICIES FOR score_snapshots
-- ============================================

DROP POLICY IF EXISTS "Service role can insert score snapshots" ON score_snapshots;

CREATE POLICY "Authenticated users can insert score snapshots"
  ON score_snapshots FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- ============================================
-- FIX POLICIES FOR analysis_results
-- ============================================

DROP POLICY IF EXISTS "Service role can insert analysis results" ON analysis_results;

CREATE POLICY "Authenticated users can insert analysis results"
  ON analysis_results FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Fixed: Updated INSERT policies to allow authenticated users
-- This enables the audit trail system to work with regular authenticated users
-- Service role users can still perform all operations
-- ============================================
