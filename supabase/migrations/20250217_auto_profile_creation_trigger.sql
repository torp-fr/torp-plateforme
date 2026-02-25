-- Phase 32.3: Auto-create profiles via trigger
-- When a user is created in auth.users, automatically create their profile
-- This eliminates the need for RPC calls from the frontend

-- Drop old trigger if exists (cleanup)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create function that runs when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Insert new profile for the created auth user
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    can_upload_kb,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    'user',
    false,
    now(),
    now()
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Log error but don't fail auth creation
  RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger: when a new auth user is created, automatically create their profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Comments for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile in profiles table when a new user is created in auth.users';
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Ensures every authenticated user has a corresponding profile record';
