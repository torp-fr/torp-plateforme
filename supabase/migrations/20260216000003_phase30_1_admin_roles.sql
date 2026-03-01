-- PHASE 30.1 — LAYOUT ISOLATION & ADMIN ROLE ENFORCEMENT
-- Migration: Ensure admin roles are properly set in profiles table
-- Date: 2026-02-16

-- ============================================================================
-- ADD ROLE COLUMN TO PROFILES (if not exists)
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============================================================================
-- SET ADMIN ROLES FOR KNOWN ADMIN EMAILS
-- ============================================================================

-- admin@admin.com → admin role
UPDATE profiles
SET role = 'admin'
WHERE email = 'admin@admin.com' AND role != 'admin';

-- Add any other known admin emails here
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@torp.fr' AND role != 'admin';

-- ============================================================================
-- VIEW: admin_users
-- ============================================================================
-- Quick view of all admin users

CREATE OR REPLACE VIEW admin_users AS
SELECT
  id,
  email,
  raw_user_meta_data->>'name' as name,
  role,
  created_at
FROM auth.users
JOIN profiles ON auth.users.id = profiles.id
WHERE profiles.role IN ('admin', 'super_admin')
ORDER BY profiles.role DESC, auth.users.created_at DESC;

-- ============================================================================
-- FUNCTION: is_admin
-- ============================================================================
-- Check if user is admin (can be used in RLS policies)

CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICY: Protect /analytics route access
-- ============================================================================
-- Uncomment if you want to use RLS policies for route protection

/*
-- Only admins can access analytics data
CREATE POLICY "Analytics only for admins" ON analysis_results
  FOR SELECT
  USING (
    is_admin(auth.uid()) OR user_id = auth.uid()
  );

-- Only admins can access live intelligence data
CREATE POLICY "Live intelligence only for admins" ON live_intelligence_snapshots
  FOR SELECT
  USING (is_admin(auth.uid()));
*/

-- ============================================================================
-- AUDIT LOG: Track admin access
-- ============================================================================
-- (Optional: requires audit_log table)

/*
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(255),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
*/

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- If needed, run:
--
-- DROP VIEW IF EXISTS admin_users;
-- DROP FUNCTION IF EXISTS is_admin(UUID);
-- ALTER TABLE profiles DROP COLUMN IF EXISTS role;
