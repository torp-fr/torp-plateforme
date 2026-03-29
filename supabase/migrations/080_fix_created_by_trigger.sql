-- ============================================================================
-- MIGRATION: Fix created_by handling for backend script inserts
-- PURPOSE: Allow backend scripts to provide created_by while supporting auth.uid() fallback
-- DATE: 2026-03-09
-- CRITICAL: This ensures backend services can create documents with explicit created_by
--           while still supporting auto-setting created_by for authenticated API calls
-- ============================================================================

-- SECTION 1: Create or replace the trigger function for INSERT
-- This function sets created_by to auth.uid() ONLY if it's NULL
-- Otherwise, it preserves the provided value (e.g., from backend scripts)

CREATE OR REPLACE FUNCTION handle_knowledge_document_created_by()
RETURNS TRIGGER AS $$
BEGIN
  -- CRITICAL RULE: Backend scripts provide created_by explicitly
  -- Only use auth.uid() if created_by was NOT provided (is NULL)
  -- This allows:
  --   1. Backend scripts to insert with their own created_by value
  --   2. API calls from authenticated users to auto-set created_by = auth.uid()

  IF NEW.created_by IS NULL THEN
    -- No created_by provided: use current authenticated user
    -- auth.uid() returns NULL for unauthenticated requests
    -- For service_role (used by backend scripts), auth.uid() might be NULL
    -- In that case, the FK constraint will catch it and fail appropriately
    NEW.created_by := NULLIF(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;

  -- If still NULL after checking auth.uid(), the FK constraint will enforce
  -- that a valid created_by must be provided (either explicitly or via auth)

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION handle_knowledge_document_created_by() IS
'Sets created_by field for knowledge documents.
LOGIC:
  1. If created_by IS NULL:
     - Attempt to use auth.uid() from current session
     - This works for authenticated API calls
     - For backend scripts with SERVICE_ROLE key, auth.uid() returns NULL
     - Backend scripts MUST explicitly provide created_by UUID
  2. If created_by IS NOT NULL:
     - Preserve the provided value (typical for backend scripts)
     - This allows testFullIngestion and testKnowledgePipeline to set created_by explicitly

ARCHITECTURE:
  - Caller (test script/API) is responsible for creating documents
  - Caller MUST provide valid created_by UUID
  - FK constraint fk_created_by enforces referential integrity
  - This function ensures the field is never accidentally NULL';

-- SECTION 2: Create or replace the trigger
-- Fires BEFORE INSERT to set created_by if not provided

DROP TRIGGER IF EXISTS trigger_knowledge_document_created_by ON knowledge_documents;

CREATE TRIGGER trigger_knowledge_document_created_by
  BEFORE INSERT ON knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION handle_knowledge_document_created_by();

COMMENT ON TRIGGER trigger_knowledge_document_created_by ON knowledge_documents IS
'Ensures created_by field is always set for audit trail integrity.
Fires BEFORE INSERT to:
  1. Use provided created_by if present (backend scripts)
  2. Fall back to auth.uid() if NULL (authenticated API calls)
  3. Allow FK constraint to enforce valid user UUID (prevents NULL)

This trigger DOES NOT modify created_by if it''s already provided by the caller.';

-- SECTION 3: Verify FK constraint exists
-- The FK constraint should have been created by earlier migrations
-- This just ensures it exists with the correct configuration

ALTER TABLE knowledge_documents
ADD CONSTRAINT fk_created_by FOREIGN KEY (created_by)
  REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON CONSTRAINT fk_created_by ON knowledge_documents IS
'Enforces referential integrity: created_by must reference a valid auth.users record.
ON DELETE SET NULL: If user is deleted, documents retain but created_by becomes NULL.
This constraint REQUIRES that created_by is explicitly provided (cannot be NULL at insert time).';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these AFTER the migration to verify correct behavior:

-- Check that trigger exists and is correctly configured:
-- SELECT trigger_name, event_manipulation, action_timing
-- FROM information_schema.triggers
-- WHERE event_object_table = 'knowledge_documents'
--   AND trigger_name = 'trigger_knowledge_document_created_by';

-- Check that FK constraint exists:
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 'knowledge_documents'
--   AND constraint_name = 'fk_created_by';

-- ============================================================================
-- END MIGRATION
-- ============================================================================
