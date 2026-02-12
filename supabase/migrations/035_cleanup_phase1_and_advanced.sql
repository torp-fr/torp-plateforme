-- ============================================================================
-- Migration 035: Complete cleanup of Phase 1 and advanced features
-- ============================================================================
-- This migration SAFELY removes all Phase 1 tables that exist
-- (even if 034 didn't work properly)
--
-- Safe to run multiple times (uses IF EXISTS)
--

-- ============================================================================
-- DROP MATERIALIZED VIEWS FIRST (before tables they depend on)
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS public.analytics_overview CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.feedback_summary CASCADE;

-- ============================================================================
-- DROP REGULAR VIEWS (if any exist)
-- ============================================================================

DROP VIEW IF EXISTS public.analytics_overview_view CASCADE;
DROP VIEW IF EXISTS public.feedback_summary_view CASCADE;

-- ============================================================================
-- DROP PHASE 1 TABLES (from your current schema)
-- ============================================================================

-- Consultation tables
DROP TABLE IF EXISTS public.phase1_prises_references CASCADE;
DROP TABLE IF EXISTS public.phase1_formalites CASCADE;
DROP TABLE IF EXISTS public.phase1_negociations CASCADE;
DROP TABLE IF EXISTS public.phase1_offres CASCADE;
DROP TABLE IF EXISTS public.phase1_contrats CASCADE;
DROP TABLE IF EXISTS public.phase1_consultations CASCADE;
DROP TABLE IF EXISTS public.phase1_dce CASCADE;
DROP TABLE IF EXISTS public.phase1_entreprises CASCADE;

-- ============================================================================
-- DROP KNOWLEDGE BASE / RAG TABLES
-- ============================================================================

DROP TABLE IF EXISTS public.knowledge_chunks CASCADE;
DROP TABLE IF EXISTS public.knowledge_documents CASCADE;
DROP TABLE IF EXISTS public.rag_health_dashboard CASCADE;

-- ============================================================================
-- DROP ADVANCED COMPANY TABLES
-- ============================================================================

DROP TABLE IF EXISTS public.company_search_history CASCADE;
DROP TABLE IF EXISTS public.company_documents CASCADE;

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
