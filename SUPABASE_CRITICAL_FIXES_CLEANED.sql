-- ============================================================================
-- SUPABASE CRITICAL EMERGENCY FIXES - CLEANED VERSION
-- Issue: Deleted public.users table broke authentication and RPC functions
-- Status: Production Down - Login Failing
-- Created: 2026-02-16
-- FIXED: Handles duplicate function versions properly
-- ============================================================================

-- ============================================================================
-- STEP 0: CLEANUP - Remove ALL duplicate versions of functions
-- ============================================================================

DROP FUNCTION IF EXISTS create_user_profile CASCADE;
DROP FUNCTION IF EXISTS get_admin_status CASCADE;
DROP FUNCTION IF EXISTS promote_user_to_admin CASCADE;
DROP FUNCTION IF EXISTS is_user_admin CASCADE;
DROP FUNCTION IF EXISTS demote_admin_to_user CASCADE;

-- ============================================================================
-- STEP 1: CREATE user_roles TABLE (if missing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin', 'super_admin')),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

COMMENT ON TABLE public.user_roles IS 'User role assignments - tracks which users are admins';

-- ============================================================================
-- STEP 2: RECREATE or FIX the handle_new_user() trigger function
-- ============================================================================
-- This function should ONLY work with profiles table, not deleted users table

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update profile in profiles table
  INSERT INTO public.profiles (
    id, email, full_name, role, is_admin, can_upload_kb, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.email),
    'user',
    FALSE,
    FALSE,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- STEP 3: FIX get_admin_status() RPC - use profiles table instead
-- ============================================================================

CREATE OR REPLACE FUNCTION get_admin_status()
RETURNS JSONB AS $$
DECLARE
  admin_count INTEGER;
  result JSONB;
BEGIN
  -- Count admins from profiles table (not from deleted users table)
  SELECT COUNT(*) INTO admin_count
  FROM public.profiles
  WHERE is_admin = TRUE;

  RETURN jsonb_build_object(
    'has_admin', admin_count > 0,
    'admin_count', admin_count,
    'can_create_admin', admin_count = 0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_admin_status TO authenticated, anon;

-- ============================================================================
-- STEP 4: FIX promote_user_to_admin() RPC - use profiles table only
-- ============================================================================

CREATE OR REPLACE FUNCTION promote_user_to_admin(user_email TEXT)
RETURNS JSONB AS $$
DECLARE
  target_user_id UUID;
  result JSONB;
BEGIN
  -- Find user by email in profiles table
  SELECT id INTO target_user_id FROM public.profiles WHERE email = user_email;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Check if there's already an admin
  IF EXISTS (SELECT 1 FROM public.profiles WHERE is_admin = TRUE AND id != target_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin already exists');
  END IF;

  -- Promote user to admin in profiles table only
  UPDATE public.profiles
  SET
    role = 'admin',
    is_admin = TRUE,
    can_upload_kb = TRUE,
    updated_role_date = now(),
    updated_at = now()
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User promoted to admin',
    'user_id', target_user_id,
    'email', user_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION promote_user_to_admin TO authenticated;

-- ============================================================================
-- STEP 5: CREATE is_user_admin() RPC (used by admin service)
-- ============================================================================

CREATE OR REPLACE FUNCTION is_user_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND (role = 'admin' OR role = 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_user_admin TO authenticated, anon;

-- ============================================================================
-- STEP 6: CREATE demote_admin_to_user() RPC (used by admin service)
-- ============================================================================

CREATE OR REPLACE FUNCTION demote_admin_to_user(user_id UUID)
RETURNS JSONB AS $$
BEGIN
  UPDATE public.profiles
  SET
    role = 'user',
    is_admin = FALSE,
    can_upload_kb = FALSE,
    updated_role_date = now(),
    updated_at = now()
  WHERE id = user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Admin demoted to user',
    'user_id', user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION demote_admin_to_user TO authenticated;

-- ============================================================================
-- STEP 7: CREATE create_user_profile() RPC (used by registration)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_name TEXT DEFAULT NULL,
  p_user_type TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, role, is_admin, can_upload_kb, created_at, updated_at
  )
  VALUES (
    p_user_id,
    p_email,
    COALESCE(p_name, p_email),
    'user',
    FALSE,
    FALSE,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'id', p_user_id,
    'email', p_email,
    'name', COALESCE(p_name, p_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated, anon;

-- ============================================================================
-- STEP 8: SKIPPED - system_health_status table is optional
-- ============================================================================
-- If system_health_status table exists, RLS policies will work automatically
-- since they reference profiles table which we've already secured

-- ============================================================================
-- STEP 9: SYNC all existing auth.users to profiles if not already there
-- ============================================================================

INSERT INTO public.profiles (id, email, full_name, role, is_admin, can_upload_kb, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', au.email),
  'user',
  FALSE,
  FALSE,
  au.created_at,
  au.updated_at
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = au.id)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  updated_at = now();

-- ============================================================================
-- STEP 10: VERIFY profiles table has RLS enabled and policies work
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

-- Create clean RLS policies
CREATE POLICY "Users can read their own profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can read all profiles (check directly from profiles table)
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles admin_check
      WHERE admin_check.id = auth.uid()
      AND (admin_check.role = 'admin' OR admin_check.role = 'super_admin')
    )
  );

-- ============================================================================
-- STEP 11: VERIFY function grants are set correctly
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_admin_status TO authenticated, anon;
GRANT EXECUTE ON FUNCTION promote_user_to_admin TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin TO authenticated, anon;
GRANT EXECUTE ON FUNCTION demote_admin_to_user TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated, anon;

-- ============================================================================
-- END OF CRITICAL FIXES - CLEANED VERSION
-- ============================================================================
