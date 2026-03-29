-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260329000013_pipeline_admin_read
-- Phase 6-P2: Admin SELECT policies for pipeline monitoring tables.
-- Service-role policies already exist; these add frontend admin read access.
-- ─────────────────────────────────────────────────────────────────────────────

-- pipeline_executions (created in 20260327130000, RLS enabled but no admin policy)
CREATE POLICY "admins_read_pipeline_executions"
  ON pipeline_executions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- pipeline_metrics (created in 20260328000005, service_role only)
CREATE POLICY "admins_read_pipeline_metrics"
  ON pipeline_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- pipeline_dead_letters (created in 20260328000005, service_role only)
CREATE POLICY "admins_read_pipeline_dead_letters"
  ON pipeline_dead_letters FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- certification_scores (created in 20260328000006, service_role only)
CREATE POLICY "admins_read_certification_scores"
  ON certification_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- company_profiles (created in 20260328000006, service_role only)
CREATE POLICY "admins_read_company_profiles"
  ON company_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );
