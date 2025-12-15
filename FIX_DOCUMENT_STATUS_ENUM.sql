-- =============================================================================
-- FIX: Add missing values to document_generation_status enum
-- =============================================================================

-- Add 'draft' value
ALTER TYPE document_generation_status ADD VALUE IF NOT EXISTS 'draft';

-- Add 'final' value
ALTER TYPE document_generation_status ADD VALUE IF NOT EXISTS 'final';

-- Add 'archived' value
ALTER TYPE document_generation_status ADD VALUE IF NOT EXISTS 'archived';

-- Verify enum values
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'document_generation_status'::regtype ORDER BY enumsortorder;
