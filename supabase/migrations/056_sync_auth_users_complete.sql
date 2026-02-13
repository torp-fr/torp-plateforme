-- ============================================================================
-- MIGRATION 056: Complete Auth Sync & Verification
-- Purpose: Ensure all auth.users are in users table with proper roles
-- ============================================================================

-- ============================================================================
-- 1. VERIFY users table has role columns
-- ============================================================================

-- Add columns if missing (idempotent)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_upload_kb BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS updated_role_date TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- 2. ENSURE RLS is enabled
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. SYNC all auth.users to users table
-- ============================================================================

INSERT INTO public.users (
  id,
  email,
  name,
  user_type,
  role,
  is_admin,
  can_upload_kb,
  created_at,
  updated_at
)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', 'User'),
  COALESCE((au.raw_user_meta_data->>'user_type')::public.user_type, 'B2C'),
  'user',
  FALSE,
  FALSE,
  au.created_at,
  COALESCE(au.updated_at, now())
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users WHERE users.id = au.id
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  updated_at = now();

-- ============================================================================
-- 4. VERIFY: Show sync results
-- ============================================================================

-- View the results
-- SELECT
--   'auth.users' as source,
--   COUNT(*) as total
-- FROM auth.users
-- UNION ALL
-- SELECT
--   'public.users',
--   COUNT(*)
-- FROM public.users
-- UNION ALL
-- SELECT
--   'public.users (with admin)',
--   COUNT(*) FILTER (WHERE is_admin = TRUE)
-- FROM public.users;

-- ============================================================================
-- END MIGRATION
-- ============================================================================
