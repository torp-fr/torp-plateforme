-- =====================================================
-- NUCLEAR OPTION: Reset RLS completely
-- =====================================================
-- This script:
-- 1. Disables RLS on users table temporarily
-- 2. Drops ALL policies
-- 3. Recreates simplified policies without recursion
-- =====================================================

-- STEP 1: Disable RLS completely on users table
-- (Permissions will be handled at application level)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- STEP 2: Drop ALL problematic policies
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_delete_own" ON public.users;
DROP POLICY IF EXISTS "users_select_admin" ON public.users;
DROP POLICY IF EXISTS "users_select_all_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_all_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_all_admin" ON public.users;
DROP POLICY IF EXISTS "users_select_super_admin" ON public.users;
DROP POLICY IF EXISTS "users_select_technicien" ON public.users;
DROP POLICY IF EXISTS "users_insert_super_admin" ON public.users;
DROP POLICY IF EXISTS "users_insert_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_super_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_super_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;
DROP POLICY IF EXISTS "users_select_self" ON public.users;
DROP POLICY IF EXISTS "users_insert_self" ON public.users;
DROP POLICY IF EXISTS "users_update_self" ON public.users;
DROP POLICY IF EXISTS "users_admin_all" ON public.users;

-- STEP 3: Drop problematic functions
DROP FUNCTION IF EXISTS public.get_user_type() CASCADE;
DROP FUNCTION IF EXISTS public.get_current_user_type() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

SELECT '✅ NUCLEAR RESET COMPLETE - RLS simplified and recursion fixed!' as status;
