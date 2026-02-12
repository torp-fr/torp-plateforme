-- ============================================================================
-- Migration 038: FINISH CLEANUP - Remove remaining Phase 1 tables
-- ============================================================================
-- This migration finishes what 037 started
-- Forces DROP of any remaining Phase 1 tables
-- Uses aggressive approach: find and destroy ALL remaining objects
--

-- ============================================================================
-- STEP 1: FIND AND REPORT remaining tables
-- ============================================================================

-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'phase1_%';

-- ============================================================================
-- STEP 2: AGGRESSIVE CLEANUP - Try multiple approaches
-- ============================================================================

DO $$
DECLARE
  r RECORD;
  tables_found INT := 0;
BEGIN
  -- Find ALL remaining Phase 1 tables
  FOR r IN (
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'phase1_%'
  )
  LOOP
    tables_found := tables_found + 1;

    -- Approach 1: Try simple DROP
    BEGIN
      EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.table_name);
      RAISE NOTICE 'Successfully dropped table: %', r.table_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Approach 1 failed for %, trying CASCADE...', r.table_name;

      -- Approach 2: Try DROP with CASCADE
      BEGIN
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.table_name) || ' CASCADE';
        RAISE NOTICE 'Successfully dropped with CASCADE: %', r.table_name;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'CASCADE also failed for %, trying RESTRICT...', r.table_name;

        -- Approach 3: Try RESTRICT (will fail if constraints, giving us info)
        BEGIN
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.table_name) || ' RESTRICT';
          RAISE NOTICE 'Successfully dropped with RESTRICT: %', r.table_name;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'All approaches failed for table: %. It may have complex dependencies.', r.table_name;
        END;
      END;
    END;
  END LOOP;

  RAISE NOTICE 'Cleanup complete. Processed % tables', tables_found;
END $$;

-- ============================================================================
-- STEP 3: VERIFY CLEANUP
-- ============================================================================

-- Run this verification:
-- SELECT COUNT(*) FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'phase1_%';
-- Should return: 0

COMMIT;
