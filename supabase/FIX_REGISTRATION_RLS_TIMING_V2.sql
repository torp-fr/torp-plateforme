-- =====================================================
-- FIX: Registration RLS Timing Issue - Version 2
-- =====================================================
-- Correction de l'erreur "column reference 'id' is ambiguous"
-- Solution: Utiliser JSONB au lieu de RETURNS TABLE pour éviter les conflits de noms
-- =====================================================

-- Drop the previous version
DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, TEXT, user_type, TEXT, TEXT);

-- Create improved RPC function
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_user_type user_type,
  p_company TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
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

  -- Fetch and return the profile as JSONB
  SELECT jsonb_build_object(
    'id', users.id,
    'email', users.email,
    'name', users.name,
    'user_type', users.user_type,
    'company', users.company,
    'phone', users.phone,
    'avatar_url', users.avatar_url,
    'subscription_plan', users.subscription_plan,
    'subscription_status', users.subscription_status
  )
  INTO v_result
  FROM public.users
  WHERE users.id = p_user_id;

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile TO anon;

-- Verify the function was created
SELECT
  routine_name,
  routine_type,
  security_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'create_user_profile';
