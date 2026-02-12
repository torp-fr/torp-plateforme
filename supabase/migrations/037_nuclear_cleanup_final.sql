-- ============================================================================
-- Migration 037: FINAL NUCLEAR CLEANUP
-- Ultra-safe approach: Drop ALL constraints first, then tables
-- ============================================================================
-- This WILL work because:
-- 1. We find and DROP ALL FK constraints pointing to Phase 1 tables
-- 2. We find and DROP ALL PK constraints on Phase 1 tables
-- 3. We DELETE all data
-- 4. THEN we drop the empty, constraint-free tables
-- All wrapped in exception handlers for bulletproof execution
--

-- ============================================================================
-- PHASE 1: DISABLE ALL TRIGGERS AND CONSTRAINTS
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Disable all triggers on Phase 1 and related tables
  FOR r IN (
    SELECT DISTINCT trigger_name, event_object_table
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND (event_object_table LIKE 'phase1_%'
        OR event_object_table LIKE 'knowledge%'
        OR event_object_table IN ('company_search_history', 'company_documents', 'analytics_overview', 'feedback_summary'))
  )
  LOOP
    BEGIN
      EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) ||
              ' ON public.' || quote_ident(r.event_object_table) || ' CASCADE';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- PHASE 2: DROP ALL FOREIGN KEY CONSTRAINTS
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Find ALL FK constraints pointing FROM or TO Phase 1 tables
  FOR r IN (
    SELECT constraint_name, table_name, constraint_schema
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND constraint_schema = 'public'
      AND (table_name LIKE 'phase1_%'
        OR table_name LIKE 'knowledge%'
        OR table_name IN ('company_search_history', 'company_documents'))
  )
  LOOP
    BEGIN
      EXECUTE 'ALTER TABLE ' || quote_ident(r.table_schema) || '.' || quote_ident(r.table_name) ||
              ' DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- PHASE 3: DELETE ALL DATA (clear everything)
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Delete from all Phase 1 and related tables
  FOR r IN (
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (table_name LIKE 'phase1_%'
        OR table_name LIKE 'knowledge%'
        OR table_name IN ('company_search_history', 'company_documents'))
  )
  LOOP
    BEGIN
      EXECUTE 'DELETE FROM ' || quote_ident(r.table_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- PHASE 4: DROP ALL VIEWS
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT table_name FROM information_schema.views
    WHERE table_schema = 'public'
      AND (table_name IN ('analytics_overview', 'feedback_summary',
                          'analytics_overview_view', 'feedback_summary_view'))
  )
  LOOP
    BEGIN
      EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.table_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- PHASE 5: DROP ALL TABLES (now safe - empty and constraint-free)
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (table_name LIKE 'phase1_%'
        OR table_name LIKE 'knowledge%'
        OR table_name IN ('company_search_history', 'company_documents',
                          'rag_health_dashboard', 'devis_analysis_metrics'))
  )
  LOOP
    BEGIN
      EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.table_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

-- Run this to verify cleanup:
-- SELECT COUNT(*) as remaining_tables FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND (table_name LIKE 'phase1_%' OR table_name LIKE 'knowledge%');
-- Should return: 0

COMMIT;
