-- =====================================================
-- DIAGNOSTIC: Registration Issues
-- =====================================================
-- Execute this in Supabase SQL Editor to diagnose registration problems

-- 1. Check if users table exists and has correct structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 2. Check RLS policies on users table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY cmd, policyname;

-- 3. Check if user_type enum exists and has correct values
SELECT
  e.enumlabel AS enum_value,
  e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'user_type'
ORDER BY e.enumsortorder;

-- 4. Check if RLS is enabled on users table
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'users';

-- 5. Test if current auth user can insert (this should show the problem)
-- Note: This will only work if you're logged in
SELECT
  auth.uid() AS current_user_id,
  current_user AS postgres_role;
