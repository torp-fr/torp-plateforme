-- ============================================================================
-- SUPABASE CRITICAL EMERGENCY FIXES
-- Issue: Deleted public.users table broke authentication and RPC functions
-- Status: Production Down - Login Failing
-- Created: 2026-02-16
-- ============================================================================
--
-- PROBLEM SUMMARY:
-- 1. GET /rest/v1/profiles?select=* returns 500 error
-- 2. RPC get_admin_status fails: "relation "public.users" does not exist"
-- 3. RLS policies reference missing public.users and public.user_roles
-- 4. Database triggers and functions still trying to use deleted tables
-- 5. System cannot create profiles for new users
--
-- ROOT CAUSES IDENTIFIED:
-- 1. Migration 055 & 056 expect public.users table to exist
-- 2. Migration 20260216000005 references non-existent public.user_roles
-- 3. RLS policies use subqueries that fail due to missing tables
-- 4. get_admin_status RPC tries to query deleted public.users
-- 5. Trigger on_auth_user_created tries to INSERT into deleted table
--
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

DROP FUNCTION IF EXISTS get_admin_status();

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

DROP FUNCTION IF EXISTS promote_user_to_admin(TEXT);

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

DROP FUNCTION IF EXISTS is_user_admin(UUID);

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

DROP FUNCTION IF EXISTS demote_admin_to_user(UUID);

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

DROP FUNCTION IF EXISTS create_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_user_type TEXT,
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
    p_name,
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
    'name', p_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated, anon;

-- ============================================================================
-- STEP 8: FIX RLS POLICY on system_alerts that references public.user_roles
-- ============================================================================
-- This view references public.user_roles which doesn't exist in all cases

DROP POLICY IF EXISTS system_health_admin_read ON public.system_health_status;

CREATE POLICY system_health_admin_read ON public.system_health_status
  FOR SELECT
  USING (
    -- Check if user is admin directly from profiles table
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR role = 'super_admin')
    )
  );

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
-- VERIFICATION QUERIES (Run these to verify fixes)
-- ============================================================================

-- Check profiles table has data
-- SELECT COUNT(*) as profile_count, COUNT(CASE WHEN is_admin THEN 1 END) as admin_count FROM public.profiles;

-- Check RPC functions exist
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE 'get_admin_status%';

-- Check auth users are synced to profiles
-- SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles);

-- Check RLS is enabled on profiles
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';

-- ============================================================================
-- END OF CRITICAL FIXES
-- ============================================================================
