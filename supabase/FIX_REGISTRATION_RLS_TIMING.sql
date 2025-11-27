-- =====================================================
-- FIX: Registration RLS Timing Issue
-- =====================================================
-- Problem: After signUp(), auth.uid() is NULL (no session yet if email confirmation required)
-- This causes RLS policies to block the SELECT query, resulting in 406 error
-- Solution: Create an RPC function with SECURITY DEFINER to create/fetch profile
-- =====================================================

-- Create RPC function to create or get user profile (bypasses RLS)
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_user_type user_type,
  p_company TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  user_type user_type,
  company TEXT,
  phone TEXT,
  avatar_url TEXT,
  subscription_plan TEXT,
  subscription_status TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert or update the user profile
  INSERT INTO public.users (
    id,
    email,
    name,
    user_type,
    company,
    phone,
    email_verified,
    onboarding_completed,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_email,
    p_name,
    p_user_type,
    p_company,
    p_phone,
    FALSE,
    FALSE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    user_type = EXCLUDED.user_type,
    company = EXCLUDED.company,
    phone = EXCLUDED.phone,
    updated_at = NOW();

  -- Return the created/updated profile
  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.name,
    u.user_type,
    u.company,
    u.phone,
    u.avatar_url,
    u.subscription_plan,
    u.subscription_status
  FROM public.users u
  WHERE u.id = p_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile TO anon;

-- Verify the function was created
SELECT
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'create_user_profile';
