-- =====================================================
-- FIX: Auto-create user profile on registration
-- =====================================================
-- This trigger automatically creates a profile in public.users
-- when a new user signs up in auth.users
-- This bypasses RLS issues during registration

-- Step 1: Drop existing policy (we'll use a trigger instead)
DROP POLICY IF EXISTS "Users can create their own profile during registration" ON public.users;

-- Step 2: Create a function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
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
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'B2C'),
    NEW.raw_user_meta_data->>'company',
    NEW.raw_user_meta_data->>'phone',
    NEW.email_confirmed_at IS NOT NULL,
    FALSE,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Step 3: Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Verify the trigger was created
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
