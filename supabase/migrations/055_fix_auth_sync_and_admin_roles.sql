-- ============================================================================
-- MIGRATION 055: Add role columns to users table + create init endpoint
-- Purpose: Add role/admin support to main users table + sync with auth
-- ============================================================================

-- ============================================================================
-- 1. ADD ROLE COLUMNS TO USERS TABLE
-- ============================================================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_upload_kb BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS updated_role_date TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON public.users(is_admin);

-- ============================================================================
-- 2. UPDATE TRIGGER: Create/Update users on auth creation
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update user in users table
  INSERT INTO public.users (
    id, email, name, user_type, role, is_admin, can_upload_kb, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    COALESCE((NEW.raw_user_meta_data->>'user_type')::public.user_type, 'B2C'),
    'user',
    FALSE,
    FALSE,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    updated_at = now();

  -- Also sync to profiles table if it exists
  INSERT INTO public.profiles (id, email, full_name, role, is_admin, can_upload_kb, created_at, updated_at)
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
    updated_at = now()
  WHERE profiles.id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 3. SYNC existing auth users to users table
-- ============================================================================

INSERT INTO public.users (id, email, name, user_type, role, is_admin, can_upload_kb, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name'),
  COALESCE((au.raw_user_meta_data->>'user_type')::public.user_type, 'B2C'),
  'user',
  FALSE,
  FALSE,
  au.created_at,
  au.updated_at
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE users.id = au.id)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. FUNCTION: Promote user to admin
-- ============================================================================

CREATE OR REPLACE FUNCTION promote_user_to_admin(user_email TEXT)
RETURNS JSONB AS $$
DECLARE
  target_user_id UUID;
  result JSONB;
BEGIN
  -- Find user by email
  SELECT id INTO target_user_id FROM public.users WHERE email = user_email;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Check if there's already an admin
  IF EXISTS (SELECT 1 FROM public.users WHERE is_admin = TRUE AND id != target_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin already exists');
  END IF;

  -- Promote user to admin
  UPDATE public.users
  SET
    role = 'admin',
    is_admin = TRUE,
    can_upload_kb = TRUE,
    updated_role_date = now(),
    updated_at = now()
  WHERE id = target_user_id;

  -- Also update profiles table if user exists there
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

-- ============================================================================
-- 5. FUNCTION: Get admin status
-- ============================================================================

CREATE OR REPLACE FUNCTION get_admin_status()
RETURNS JSONB AS $$
DECLARE
  admin_count INTEGER;
  result JSONB;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM public.users WHERE is_admin = TRUE;

  RETURN jsonb_build_object(
    'has_admin', admin_count > 0,
    'admin_count', admin_count,
    'can_create_admin', admin_count = 0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. RLS POLICIES: Users table
-- ============================================================================

-- Allow authenticated users to read themselves + admins to read all
DROP POLICY IF EXISTS "Users can read own record" ON public.users;
CREATE POLICY "Users can read own record" ON public.users
  FOR SELECT
  USING (auth.uid() = id OR (SELECT is_admin FROM public.users WHERE id = auth.uid()) = TRUE);

-- ============================================================================
-- 7. GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION promote_user_to_admin TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_status TO authenticated, anon;

-- ============================================================================
-- 8. VERIFICATION
-- ============================================================================

-- SELECT COUNT(*) as users_with_roles FROM public.users WHERE role IS NOT NULL;
-- SELECT * FROM public.users WHERE is_admin = TRUE;

-- ============================================================================
-- END MIGRATION
-- ============================================================================
