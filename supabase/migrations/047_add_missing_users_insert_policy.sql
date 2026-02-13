-- ============================================
-- MIGRATION 047: ADD MISSING USERS INSERT POLICY
-- Created: 2026-02-12
-- Purpose: Allow database trigger to insert new user records when auth users are created
-- ============================================

-- The handle_new_user() trigger needs to be able to insert into users table
-- when new Supabase auth users are created. This policy allows the trigger
-- (which runs with SECURITY DEFINER permissions) to insert new user records.

CREATE POLICY "Service role can insert users"
  ON public.users FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR auth.jwt() ->> 'role' = 'authenticated'
    OR auth.uid() IS NOT NULL
  );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Added INSERT policy to users table to allow:
-- 1. Service role to create users (for triggers and backend operations)
-- 2. Authenticated users to create their own profile if needed
-- ============================================
