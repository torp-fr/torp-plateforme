-- =============================================================================
-- FIX: wizard_mode enum values
-- =============================================================================
-- Run this in Supabase SQL Editor if you get the error:
-- "invalid input value for enum wizard_mode: b2c_simple"
-- =============================================================================

-- Option 1: Add missing values to existing enum
-- Note: Run each line separately if you get errors

-- Add b2c_simple if missing
ALTER TYPE wizard_mode ADD VALUE IF NOT EXISTS 'b2c_simple';

-- Add b2c_detailed if missing
ALTER TYPE wizard_mode ADD VALUE IF NOT EXISTS 'b2c_detailed';

-- Add b2b_professional if missing
ALTER TYPE wizard_mode ADD VALUE IF NOT EXISTS 'b2b_professional';

-- Add b2g_public if missing
ALTER TYPE wizard_mode ADD VALUE IF NOT EXISTS 'b2g_public';

-- =============================================================================
-- Option 2: If the enum doesn't exist, create it
-- =============================================================================
-- Uncomment and run this if the enum doesn't exist at all:
/*
CREATE TYPE wizard_mode AS ENUM (
  'b2c_simple',
  'b2c_detailed',
  'b2b_professional',
  'b2g_public'
);
*/

-- =============================================================================
-- Option 3: Complete recreation (DESTRUCTIVE - use only if needed)
-- =============================================================================
-- WARNING: This will fail if the column is in use. Only use in development.
/*
-- 1. First, drop the column that uses the enum
ALTER TABLE phase0_projects DROP COLUMN IF EXISTS wizard_mode;

-- 2. Drop the old enum
DROP TYPE IF EXISTS wizard_mode;

-- 3. Create the enum with correct values
CREATE TYPE wizard_mode AS ENUM (
  'b2c_simple',
  'b2c_detailed',
  'b2b_professional',
  'b2g_public'
);

-- 4. Re-add the column
ALTER TABLE phase0_projects
ADD COLUMN wizard_mode wizard_mode NOT NULL DEFAULT 'b2c_simple';
*/

-- =============================================================================
-- Verify: Check current enum values
-- =============================================================================
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'wizard_mode'::regtype
ORDER BY enumsortorder;
