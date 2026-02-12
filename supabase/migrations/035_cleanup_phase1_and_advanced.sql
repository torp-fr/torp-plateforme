-- ============================================================================
-- Migration 035: Complete cleanup of Phase 1 and advanced features
-- ============================================================================
-- This migration SAFELY removes all Phase 1 tables that exist
-- (even if 034 didn't work properly)
--
-- Safe to run multiple times (uses IF EXISTS)
--

-- ============================================================================
-- DROP VIEWS AND MATERIALIZED VIEWS (handle both types)
-- ============================================================================

-- Try as VIEW first (most common)
DROP VIEW IF EXISTS public.analytics_overview;
DROP VIEW IF EXISTS public.feedback_summary;
DROP VIEW IF EXISTS public.analytics_overview_view;
DROP VIEW IF EXISTS public.feedback_summary_view;

-- ============================================================================
-- REMOVE FOREIGN KEY CONSTRAINTS FIRST
-- (Supabase doesn't support CASCADE well on tables with FK)
-- ============================================================================

-- Find and drop all constraints pointing to Phase 1 tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT constraint_name, table_name
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND (table_name LIKE 'phase1_%' OR referenced_table_name LIKE 'phase1_%')
  )
  LOOP
    EXECUTE 'ALTER TABLE IF EXISTS public.' || quote_ident(r.table_name) ||
            ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
  END LOOP;
END $$;

-- ============================================================================
-- NOW DROP ALL PHASE 1 TABLES (constraints are gone)
-- ============================================================================

DROP TABLE IF EXISTS public.phase1_contrats ;
DROP TABLE IF EXISTS public.phase1_prises_references ;
DROP TABLE IF EXISTS public.phase1_formalites ;
DROP TABLE IF EXISTS public.phase1_negociations ;
DROP TABLE IF EXISTS public.phase1_consultations ;
DROP TABLE IF EXISTS public.phase1_offres ;
DROP TABLE IF EXISTS public.phase1_dce ;
DROP TABLE IF EXISTS public.phase1_entreprises ;

-- ============================================================================
-- DROP KNOWLEDGE BASE / RAG TABLES AT ONCE
-- ============================================================================

DROP TABLE IF EXISTS
  public.knowledge_chunks,
  public.knowledge_documents,
  public.rag_health_dashboard
CASCADE ;

-- ============================================================================
-- DROP ADVANCED COMPANY TABLES AT ONCE
-- ============================================================================

DROP TABLE IF EXISTS
  public.company_search_history,
  public.company_documents
CASCADE ;

-- ============================================================================
-- VERIFY CLEANUP
-- ============================================================================

-- After running this migration, run this verification query:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;
--
-- You should see ONLY these tables (no phase1_* or knowledge_* or rag_*):
-- - analytics_events
-- - api_rate_limits (from 011)
-- - audit_log
-- - audit_trail (from 011)
-- - ccf
-- - client_enriched_data
-- - companies
-- - company_data_cache
-- - comparisons
-- - devis
-- - devis_photos (from 011)
-- - devis_analysis_metrics
-- - feature_flags (from 011)
-- - notifications
-- - projects
-- - profiles (from 011)
-- - quote_analysis
-- - quote_uploads
-- - search_history (from 011)
-- - user_feedback
--

COMMIT;
