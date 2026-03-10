-- ============================================================================
-- MIGRATION: Fix auth trigger to assign default organization_id
-- Purpose: Ensure profiles receive a default organization when created via trigger
-- ============================================================================

-- Step 1: Create organizations table if it doesn't exist
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT UNIQUE,
  description TEXT,
  logo_url TEXT,
  website TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- RLS policy: everyone can read organizations
CREATE POLICY "Everyone can read organizations" ON organizations
  FOR SELECT
  USING (true);

-- Step 2: Add organization_id column to profiles if it doesn't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT;

-- Step 3: Ensure the System Ingestion organization exists
INSERT INTO organizations (name, slug, description)
VALUES ('System Ingestion', 'system-ingestion', 'Default organization for system-level ingestion')
ON CONFLICT (name) DO NOTHING;

-- Step 4: Update existing profiles without an organization to use the System Ingestion org
UPDATE profiles p
SET organization_id = (
  SELECT id FROM organizations WHERE name = 'System Ingestion' LIMIT 1
)
WHERE p.organization_id IS NULL;

-- Step 5: Add NOT NULL constraint to organization_id
-- First, ensure all profiles have an organization_id
ALTER TABLE profiles
ALTER COLUMN organization_id SET NOT NULL;

-- Step 6: Update the trigger to include organization_id
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  default_org UUID;
BEGIN
  -- Get the system organization ID
  SELECT id INTO default_org
  FROM organizations
  WHERE name = 'System Ingestion'
  LIMIT 1;

  -- If system org doesn't exist, create it
  IF default_org IS NULL THEN
    INSERT INTO organizations (name, slug, description)
    VALUES ('System Ingestion', 'system-ingestion', 'Default organization for system-level ingestion')
    ON CONFLICT (name) DO NOTHING
    RETURNING id INTO default_org;
  END IF;

  -- Insert new profile for the created auth user with default organization
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    can_upload_kb,
    organization_id,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    'user',
    false,
    default_org,
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

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update comments
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile in profiles table with default organization_id when a new user is created in auth.users';
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Ensures every authenticated user has a corresponding profile record with organization_id';

-- ============================================================================
-- END MIGRATION
-- ============================================================================
