-- =====================================================
-- TORP Admin Access Policies
-- Migration: 004_admin_access_policies.sql
-- Description: Politiques RLS pour accès admin + fonctions helper
-- Date: 2025-11-26
-- =====================================================

-- =====================================================
-- FONCTION: Vérifier si l'utilisateur est admin
-- =====================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM users
    WHERE id = auth.uid()
    AND user_type = 'admin'
  ) INTO v_is_admin;

  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- =====================================================
-- POLITIQUE RLS: Admin peut voir tous les feedbacks
-- =====================================================

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Admins can view all feedback" ON user_feedback;

-- Create new policy for admin access
CREATE POLICY "Admins can view all feedback"
  ON user_feedback
  FOR SELECT
  USING (
    auth.uid() = user_id OR is_admin()
  );

-- =====================================================
-- POLITIQUE RLS: Admin peut voir tous les utilisateurs
-- =====================================================

-- Activer RLS sur users si pas déjà fait
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if exist
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins can view all users"
  ON users
  FOR SELECT
  USING (is_admin());

-- =====================================================
-- POLITIQUE RLS: Admin peut voir toutes les analyses
-- =====================================================

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Admins can view all metrics" ON devis_analysis_metrics;

-- Create new policy for admin access
CREATE POLICY "Admins can view all metrics"
  ON devis_analysis_metrics
  FOR SELECT
  USING (
    auth.uid() = user_id OR is_admin()
  );

-- =====================================================
-- FONCTION RPC: Récupérer tous les feedbacks (admin)
-- =====================================================
CREATE OR REPLACE FUNCTION get_all_feedbacks()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  user_type TEXT,
  feedback_type TEXT,
  category TEXT,
  satisfaction_score INTEGER,
  title TEXT,
  message TEXT,
  page_url TEXT,
  screenshot_url TEXT,
  metadata JSONB,
  status TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier que l'utilisateur est admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.user_id,
    f.user_email,
    f.user_type,
    f.feedback_type,
    f.category,
    f.satisfaction_score,
    f.title,
    f.message,
    f.page_url,
    f.screenshot_url,
    f.metadata,
    f.status,
    f.admin_notes,
    f.created_at,
    f.updated_at
  FROM user_feedback f
  ORDER BY f.created_at DESC;
END;
$$;

-- =====================================================
-- FONCTION RPC: Récupérer tous les utilisateurs (admin)
-- =====================================================
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  user_type TEXT,
  company TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  subscription_plan TEXT,
  subscription_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier que l'utilisateur est admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.name,
    u.user_type,
    u.company,
    u.phone,
    u.created_at,
    u.subscription_plan,
    u.subscription_status
  FROM users u
  ORDER BY u.created_at DESC;
END;
$$;

-- =====================================================
-- FONCTION RPC: Récupérer toutes les analyses (admin)
-- =====================================================
CREATE OR REPLACE FUNCTION get_all_analyses()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  user_type TEXT,
  devis_id UUID,
  torp_score_overall DECIMAL,
  torp_score_transparency DECIMAL,
  torp_score_offer DECIMAL,
  torp_score_robustness DECIMAL,
  torp_score_price DECIMAL,
  grade TEXT,
  analysis_duration_ms INTEGER,
  file_size_bytes INTEGER,
  file_type TEXT,
  upload_success BOOLEAN,
  upload_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier que l'utilisateur est admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.user_id,
    u.email as user_email,
    m.user_type,
    m.devis_id,
    m.torp_score_overall,
    m.torp_score_transparency,
    m.torp_score_offer,
    m.torp_score_robustness,
    m.torp_score_price,
    m.grade,
    m.analysis_duration_ms,
    m.file_size_bytes,
    m.file_type,
    m.upload_success,
    m.upload_error,
    m.created_at
  FROM devis_analysis_metrics m
  LEFT JOIN users u ON m.user_id = u.id
  ORDER BY m.created_at DESC;
END;
$$;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION is_admin() IS 'Vérifie si l''utilisateur courant est admin';
COMMENT ON FUNCTION get_all_feedbacks() IS 'Récupère tous les feedbacks (admin uniquement)';
COMMENT ON FUNCTION get_all_users() IS 'Récupère tous les utilisateurs (admin uniquement)';
COMMENT ON FUNCTION get_all_analyses() IS 'Récupère toutes les analyses (admin uniquement)';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
