-- =====================================================
-- FIX: Add missing INSERT policy for user registration
-- =====================================================
-- This fixes the "database error saving new user" error
-- during registration by allowing authenticated users to
-- create their own profile in the users table.

-- Add INSERT policy for users table
CREATE POLICY "Users can create their own profile during registration"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Verify the policy was created
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
ORDER BY policyname;
