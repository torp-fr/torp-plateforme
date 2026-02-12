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
-- DROP PHASE 1 TABLES (from your current schema)
-- ============================================================================

-- Consultation tables
DROP TABLE IF EXISTS public.phase1_prises_references ;
DROP TABLE IF EXISTS public.phase1_formalites ;
DROP TABLE IF EXISTS public.phase1_negociations ;
DROP TABLE IF EXISTS public.phase1_offres ;
DROP TABLE IF EXISTS public.phase1_contrats ;
DROP TABLE IF EXISTS public.phase1_consultations ;
DROP TABLE IF EXISTS public.phase1_dce ;
DROP TABLE IF EXISTS public.phase1_entreprises ;

-- ============================================================================
-- DROP KNOWLEDGE BASE / RAG TABLES
-- ============================================================================

DROP TABLE IF EXISTS public.knowledge_chunks ;
DROP TABLE IF EXISTS public.knowledge_documents ;
DROP TABLE IF EXISTS public.rag_health_dashboard ;

-- ============================================================================
-- DROP ADVANCED COMPANY TABLES
-- ============================================================================

DROP TABLE IF EXISTS public.company_search_history ;
DROP TABLE IF EXISTS public.company_documents ;

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
