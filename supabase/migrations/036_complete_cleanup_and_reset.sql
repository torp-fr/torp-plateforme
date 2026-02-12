-- ============================================================================
-- Migration 036: Complete Cleanup and Reset to MVP Schema
-- ============================================================================
-- This migration:
-- 1. TRUNCATE all Phase 1 tables (removes data + FK constraints)
-- 2. DROP all Phase 1, Knowledge Base, and advanced tables
-- 3. DROP all advanced views
-- 4. Leaves core MVP schema intact
--

-- ============================================================================
-- STEP 1: TRUNCATE ALL PHASE 1 TABLES (clears data + constraints)
-- ============================================================================

TRUNCATE TABLE IF EXISTS public.phase1_contrats CASCADE;
TRUNCATE TABLE IF EXISTS public.phase1_prises_references CASCADE;
TRUNCATE TABLE IF EXISTS public.phase1_formalites CASCADE;
TRUNCATE TABLE IF EXISTS public.phase1_negociations CASCADE;
TRUNCATE TABLE IF EXISTS public.phase1_consultations CASCADE;
TRUNCATE TABLE IF EXISTS public.phase1_offres CASCADE;
TRUNCATE TABLE IF EXISTS public.phase1_dce CASCADE;
TRUNCATE TABLE IF EXISTS public.phase1_entreprises CASCADE;

TRUNCATE TABLE IF EXISTS public.knowledge_chunks CASCADE;
TRUNCATE TABLE IF EXISTS public.knowledge_documents CASCADE;
TRUNCATE TABLE IF EXISTS public.rag_health_dashboard CASCADE;

TRUNCATE TABLE IF EXISTS public.company_search_history CASCADE;
TRUNCATE TABLE IF EXISTS public.company_documents CASCADE;

-- ============================================================================
-- STEP 2: DROP ALL VIEWS AND MATERIALIZED VIEWS
-- ============================================================================

DROP VIEW IF EXISTS public.analytics_overview;
DROP VIEW IF EXISTS public.feedback_summary;
DROP VIEW IF EXISTS public.analytics_overview_view;
DROP VIEW IF EXISTS public.feedback_summary_view;

-- ============================================================================
-- STEP 3: NOW DROP ALL TABLES (no FK issues after TRUNCATE)
-- ============================================================================

-- Phase 1 tables
DROP TABLE IF EXISTS public.phase1_contrats;
DROP TABLE IF EXISTS public.phase1_prises_references;
DROP TABLE IF EXISTS public.phase1_formalites;
DROP TABLE IF EXISTS public.phase1_negociations;
DROP TABLE IF EXISTS public.phase1_consultations;
DROP TABLE IF EXISTS public.phase1_offres;
DROP TABLE IF EXISTS public.phase1_dce;
DROP TABLE IF EXISTS public.phase1_entreprises;

-- Knowledge base tables
DROP TABLE IF EXISTS public.knowledge_chunks;
DROP TABLE IF EXISTS public.knowledge_documents;
DROP TABLE IF EXISTS public.rag_health_dashboard;

-- Advanced company tables
DROP TABLE IF EXISTS public.company_search_history;
DROP TABLE IF EXISTS public.company_documents;

-- ============================================================================
-- VERIFY CLEANUP
-- ============================================================================

-- After running this migration, verify:
--
-- SELECT COUNT(*) FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'phase1_%';
-- Should return: 0
--
-- SELECT COUNT(*) FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'knowledge%';
-- Should return: 0
--
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;
-- Should show ONLY MVP tables:
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
-- - devis_analysis_metrics
-- - devis_photos (from 011)
-- - feature_flags (from 011)
-- - notifications
-- - profiles (from 011)
-- - projects
-- - quote_analysis
-- - quote_uploads
-- - search_history (from 011)
-- - user_feedback
--

COMMIT;
