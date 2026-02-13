-- ============================================================================
-- QUICK FIX: Sync auth.users to users table + verify everything
-- Copy/paste this entire script in Supabase SQL Editor and run it
-- ============================================================================

-- STEP 1: VERIFY structure ================================================
SELECT '🔍 CHECKING TABLE STRUCTURE...' as step;

-- Check users table exists
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')
    THEN '✅ users table exists'
    ELSE '❌ users table missing'
  END as status;

-- Check role columns exist
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
AND column_name IN ('role', 'is_admin', 'can_upload_kb')
ORDER BY column_name;

-- STEP 2: COUNT USERS ===================================================
SELECT '📊 USER COUNTS BEFORE SYNC' as step;

SELECT
  'auth.users' as source,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE raw_user_meta_data->>'user_type' = 'B2B') as b2b_count,
  COUNT(*) FILTER (WHERE raw_user_meta_data->>'user_type' = 'B2C') as b2c_count
FROM auth.users
UNION ALL
SELECT
  'public.users' as source,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE user_type::text = 'B2B') as b2b_count,
  COUNT(*) FILTER (WHERE user_type::text = 'B2C') as b2c_count
FROM public.users
UNION ALL
SELECT
  'public.users (admin)' as source,
  COUNT(*) FILTER (WHERE is_admin = TRUE) as count,
  0 as b2b_count,
  0 as b2c_count
FROM public.users;

-- STEP 3: ADD MISSING COLUMNS ============================================
SELECT '➕ ADDING ROLE COLUMNS IF MISSING...' as step;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin'));

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS can_upload_kb BOOLEAN DEFAULT FALSE;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS updated_role_date TIMESTAMP WITH TIME ZONE;

SELECT '✅ Columns added' as status;

-- STEP 4: SYNC AUTH USERS TO USERS TABLE ================================
SELECT '🔄 SYNCING auth.users → public.users...' as step;

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

SELECT '✅ Sync complete' as status;

-- STEP 5: VERIFY FINAL STATE ============================================
SELECT '✨ FINAL STATE' as step;

SELECT
  'Total users synced' as metric,
  COUNT(*) as count
FROM public.users
UNION ALL
SELECT
  'Admins created',
  COUNT(*) FILTER (WHERE is_admin = TRUE)
FROM public.users
UNION ALL
SELECT
  'B2C users',
  COUNT(*) FILTER (WHERE user_type::text = 'B2C')
FROM public.users
UNION ALL
SELECT
  'B2B users',
  COUNT(*) FILTER (WHERE user_type::text = 'B2B')
FROM public.users;

-- STEP 6: SHOW ALL USERS ================================================
SELECT '📋 ALL USERS IN SYSTEM' as step;

SELECT
  email,
  name,
  user_type::text as user_type,
  role,
  is_admin,
  can_upload_kb,
  created_at
FROM public.users
ORDER BY created_at DESC;

-- ============================================================================
-- DONE! ✅
-- If all users appear above, sync is complete and working.
-- ============================================================================
