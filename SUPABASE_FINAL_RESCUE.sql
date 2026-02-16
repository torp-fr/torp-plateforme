-- ============================================================================
-- SUPABASE FINAL RESCUE - ADD MISSING COLUMNS FIRST
-- This adds missing columns to profiles table before any operations
-- ============================================================================

-- ============================================================================
-- STEP 1: ADD MISSING COLUMNS TO profiles TABLE
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_upload_kb BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_role_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================================================
-- STEP 2: CREATE user_roles TABLE (if missing)
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

-- ============================================================================
-- STEP 3: CLEAN UP OLD FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS create_user_profile CASCADE;
DROP FUNCTION IF EXISTS get_admin_status CASCADE;
DROP FUNCTION IF EXISTS promote_user_to_admin CASCADE;
DROP FUNCTION IF EXISTS is_user_admin CASCADE;
DROP FUNCTION IF EXISTS demote_admin_to_user CASCADE;

-- ============================================================================
-- STEP 4: CREATE TRIGGER for new auth users
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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
-- STEP 5: CREATE get_admin_status() RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION get_admin_status()
RETURNS JSONB AS $$
DECLARE
  admin_count INTEGER;
BEGIN
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
-- STEP 6: CREATE is_user_admin() RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION is_user_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_user_admin(user_id UUID) TO authenticated, anon;

-- ============================================================================
-- STEP 7: CREATE promote_user_to_admin() RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION promote_user_to_admin(user_email TEXT)
RETURNS JSONB AS $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id FROM public.profiles WHERE email = user_email;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE is_admin = TRUE AND id != target_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin already exists');
  END IF;

  UPDATE public.profiles
  SET is_admin = TRUE, role = 'admin', can_upload_kb = TRUE, updated_at = now()
  WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'User promoted to admin', 'user_id', target_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION promote_user_to_admin(user_email TEXT) TO authenticated;

-- ============================================================================
-- STEP 8: CREATE demote_admin_to_user() RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION demote_admin_to_user(user_id UUID)
RETURNS JSONB AS $$
BEGIN
  UPDATE public.profiles
  SET is_admin = FALSE, role = 'user', can_upload_kb = FALSE, updated_at = now()
  WHERE id = user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Admin demoted to user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION demote_admin_to_user(user_id UUID) TO authenticated;

-- ============================================================================
-- STEP 9: CREATE create_user_profile() RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_name TEXT DEFAULT NULL
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

  RETURN jsonb_build_object('success', true, 'id', p_user_id, 'email', p_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT) TO authenticated, anon;

-- ============================================================================
-- STEP 10: ENABLE RLS ON profiles TABLE
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

-- Create new policies
CREATE POLICY "Users can read their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ============================================================================
-- STEP 11: SYNC ALL AUTH USERS TO PROFILES
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
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- END FINAL RESCUE
-- ============================================================================
