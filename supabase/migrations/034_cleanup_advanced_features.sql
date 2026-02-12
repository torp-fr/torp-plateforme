-- ============================================================
-- CLEANUP MIGRATION: Remove advanced/unused features
-- Purpose: Reset schema to MVP essentials only
-- ============================================================
--
-- This migration removes:
-- - Phase 0, 1, 2, 3, 4 tables (conception wizard, tenders, etc.)
-- - Advanced B2B tables not needed for MVP
-- - Advanced knowledge base/RAG tables
-- - Unnecessary columns added by later migrations
--
-- SAFE: Uses IF EXISTS so idempotent
--

-- ============================================================
-- PHASE 0: Conception/Wizard Tables (DROP)
-- ============================================================

DROP TABLE IF EXISTS public.phase0_financing_sources CASCADE;
DROP TABLE IF EXISTS public.phase0_aides_eligibility CASCADE;
DROP TABLE IF EXISTS public.phase0_budget_items CASCADE;
DROP TABLE IF EXISTS public.phase0_cctp_lots CASCADE;
DROP TABLE IF EXISTS public.phase0_feasibility_checks CASCADE;
DROP TABLE IF EXISTS public.phase0_diagnostic_reports CASCADE;
DROP TABLE IF EXISTS public.phase0_lot_reference CASCADE;
DROP TABLE IF EXISTS public.phase0_api_cache CASCADE;
DROP TABLE IF EXISTS public.phase0_deductions CASCADE;
DROP TABLE IF EXISTS public.phase0_selected_lots CASCADE;
DROP TABLE IF EXISTS public.phase0_wizard_progress CASCADE;
DROP TABLE IF EXISTS public.phase0_conception_modules CASCADE;
DROP TABLE IF EXISTS public.phase0_documents CASCADE;
DROP TABLE IF EXISTS public.phase0_projects CASCADE;

-- ============================================================
-- TENDER/B2B ADVANCED Tables (DROP)
-- ============================================================

DROP TABLE IF EXISTS public.tender_questions CASCADE;
DROP TABLE IF EXISTS public.tender_responses CASCADE;
DROP TABLE IF EXISTS public.tender_invitations CASCADE;
DROP TABLE IF EXISTS public.tender_documents CASCADE;
DROP TABLE IF EXISTS public.tenders CASCADE;
DROP TABLE IF EXISTS public.torp_tickets CASCADE;
DROP TABLE IF EXISTS public.tickets CASCADE;
DROP TABLE IF EXISTS public.pro_devis_analyses CASCADE;
DROP TABLE IF EXISTS public.company_specializations CASCADE;

-- ============================================================
-- ADVANCED FEATURES (DROP)
-- ============================================================

DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.project_contexts CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.room_works CASCADE;
DROP TABLE IF EXISTS public.knowledge_base_documents CASCADE;
DROP TABLE IF EXISTS public.knowledge_base_chunks CASCADE;
DROP TABLE IF EXISTS public.kb_analysis_logs CASCADE;
DROP TABLE IF EXISTS public.rag_context_cache CASCADE;
DROP TABLE IF EXISTS public.knowledge_uploads CASCADE;
DROP TABLE IF EXISTS public.knowledge_collections CASCADE;
DROP TABLE IF EXISTS public.devis_analysis_metrics CASCADE;
DROP TABLE IF EXISTS public.comparisons CASCADE;

-- ============================================================
-- DROP ADVANCED FUNCTIONS
-- ============================================================

-- Phase 0 functions
DROP FUNCTION IF EXISTS public.generate_phase0_reference() CASCADE;
DROP FUNCTION IF EXISTS public.set_phase0_reference() CASCADE;
DROP FUNCTION IF EXISTS public.update_phase0_lots_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_phase0_zone_proximite() CASCADE;
DROP FUNCTION IF EXISTS public.update_devis_coefficient_regional() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_phase0_completeness(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_financing_coverage(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_total_aides(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_diagnostic_score(UUID) CASCADE;

-- Tender functions
DROP FUNCTION IF EXISTS public.generate_tender_reference() CASCADE;
DROP FUNCTION IF EXISTS public.generate_response_reference() CASCADE;
DROP FUNCTION IF EXISTS public.generate_ticket_code() CASCADE;
DROP FUNCTION IF EXISTS public.update_tender_responses_count() CASCADE;
DROP FUNCTION IF EXISTS public.set_tender_reference() CASCADE;
DROP FUNCTION IF EXISTS public.set_response_reference() CASCADE;

-- RAG functions
DROP FUNCTION IF EXISTS public.search_kb_by_similarity(vector, integer, float) CASCADE;
DROP FUNCTION IF EXISTS public.search_knowledge(vector, integer, float) CASCADE;
DROP FUNCTION IF EXISTS public.get_knowledge_stats() CASCADE;
DROP FUNCTION IF EXISTS public.update_knowledge_timestamp() CASCADE;
DROP FUNCTION IF EXISTS public.rag_health_check() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_empty_chunks() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_short_chunks() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_orphan_chunks() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_no_embedding_chunks() CASCADE;
DROP FUNCTION IF EXISTS public.rag_full_cleanup() CASCADE;
DROP FUNCTION IF EXISTS public.rag_document_stats() CASCADE;
DROP FUNCTION IF EXISTS public.rag_problematic_documents() CASCADE;

-- Company functions
DROP FUNCTION IF EXISTS public.should_refresh_company_cache(text) CASCADE;
DROP FUNCTION IF EXISTS public.increment_company_cache_fetch_count(text) CASCADE;
DROP FUNCTION IF EXISTS public.upsert_company_cache() CASCADE;
DROP FUNCTION IF EXISTS public.get_cached_company_data(text) CASCADE;
DROP FUNCTION IF EXISTS public.clean_expired_company_cache() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_company_data_quality(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.update_company_siren() CASCADE;

-- Scoring functions
DROP FUNCTION IF EXISTS public.calculate_torp_score(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.assign_grade(numeric) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_score_localisation(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.determine_zone_proximite(numeric) CASCADE;
DROP FUNCTION IF EXISTS public.get_coefficient_regional_btp(varchar) CASCADE;

-- ============================================================
-- DROP ADVANCED ENUMS
-- ============================================================

DROP TYPE IF EXISTS public.user_type CASCADE;
DROP TYPE IF EXISTS public.project_phase CASCADE;
DROP TYPE IF EXISTS public.phase0_lot_type CASCADE;
DROP TYPE IF EXISTS public.phase0_work_type CASCADE;
DROP TYPE IF EXISTS public.wizard_mode CASCADE;

-- ============================================================
-- REMOVE ADVANCED COLUMNS (if they exist in MVP tables)
-- ============================================================

-- From companies table
ALTER TABLE IF EXISTS public.companies
  DROP COLUMN IF EXISTS rge_number CASCADE;
ALTER TABLE IF EXISTS public.companies
  DROP COLUMN IF EXISTS rge_valid_until CASCADE;
ALTER TABLE IF EXISTS public.companies
  DROP COLUMN IF EXISTS pappers_data CASCADE;
ALTER TABLE IF EXISTS public.companies
  DROP COLUMN IF EXISTS google_data CASCADE;

-- From devis table
ALTER TABLE IF EXISTS public.devis
  DROP COLUMN IF EXISTS coefficient_regional CASCADE;
ALTER TABLE IF EXISTS public.devis
  DROP COLUMN IF EXISTS zone_proximite CASCADE;
ALTER TABLE IF EXISTS public.devis
  DROP COLUMN IF EXISTS distance_km CASCADE;

-- ============================================================
-- DROP ADVANCED STORAGE BUCKETS (via soft delete - keep structure)
-- ============================================================
--
-- NOTE: Storage buckets CANNOT be deleted via SQL
-- Delete manually via Supabase Dashboard if needed:
-- - pro-devis
-- - phase0-photos
-- - documents (if not used)
--

-- ============================================================
-- VERIFY CLEANUP
-- ============================================================

-- Check remaining tables (should only see MVP essentials)
-- Run this after migration to verify:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;
--
-- Expected tables:
-- - audit_log
-- - ccf (or projects)
-- - companies
-- - company_data_cache
-- - devis (or quotes)
-- - devis_photos
-- - enriched_client_data (or client_enriched_data)
-- - profiles
-- - quote_analysis
-- - quote_uploads
-- - search_history
-- - storage.buckets (system table)
-- - user_feedback
-- - analytics_events
--

COMMIT;
