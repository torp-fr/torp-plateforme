-- Fix wizard_mode enum to include all expected values
-- This migration ensures the wizard_mode enum has all required values

-- First, check if the enum exists and add missing values if needed
DO $$
BEGIN
  -- Check if 'b2c_simple' value exists in wizard_mode enum
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'wizard_mode'::regtype
    AND enumlabel = 'b2c_simple'
  ) THEN
    ALTER TYPE wizard_mode ADD VALUE IF NOT EXISTS 'b2c_simple';
  END IF;

  -- Check if 'b2c_detailed' value exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'wizard_mode'::regtype
    AND enumlabel = 'b2c_detailed'
  ) THEN
    ALTER TYPE wizard_mode ADD VALUE IF NOT EXISTS 'b2c_detailed';
  END IF;

  -- Check if 'b2b_professional' value exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'wizard_mode'::regtype
    AND enumlabel = 'b2b_professional'
  ) THEN
    ALTER TYPE wizard_mode ADD VALUE IF NOT EXISTS 'b2b_professional';
  END IF;

  -- Check if 'b2g_public' value exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'wizard_mode'::regtype
    AND enumlabel = 'b2g_public'
  ) THEN
    ALTER TYPE wizard_mode ADD VALUE IF NOT EXISTS 'b2g_public';
  END IF;
END $$;

-- If the enum doesn't exist at all, create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wizard_mode') THEN
    CREATE TYPE wizard_mode AS ENUM (
      'b2c_simple',
      'b2c_detailed',
      'b2b_professional',
      'b2g_public'
    );
  END IF;
END $$;

-- Verify the enum values
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'wizard_mode'::regtype;
