-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260329000011_admin_read_monitoring
-- Phase 5.5 - PROMPT H5: Allow authenticated admins to read monitoring tables
-- ─────────────────────────────────────────────────────────────────────────────

-- Admin read access to api_health_metrics
CREATE POLICY "admins_read_api_health_metrics"
  ON api_health_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Admin read access to api_costs
CREATE POLICY "admins_read_api_costs"
  ON api_costs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Admin read access to api_pricing_config
CREATE POLICY "admins_read_api_pricing_config"
  ON api_pricing_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );
