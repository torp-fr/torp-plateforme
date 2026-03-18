-- =============================================================================
-- MIGRATION: Add signature column to rules table
-- Date: 2026-03-17
-- Description: Enables deduplication at the DB level via a UNIQUE constraint
--              on the rule signature (domain|element|property|operator|value|unit).
--              The worker uses INSERT ... ON CONFLICT (signature) DO NOTHING.
-- Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS pattern).
-- =============================================================================

-- 1. Add the column (idempotent)
ALTER TABLE rules
  ADD COLUMN IF NOT EXISTS signature TEXT;

-- 2. Unique index — this is the conflict target used by the worker upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_rules_signature
  ON rules (signature);

-- =============================================================================
-- VERIFY
-- =============================================================================
-- After applying, run these to confirm:
--
-- Column exists:
--   SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_name = 'rules' AND column_name = 'signature';
--
-- Unique index exists:
--   SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE tablename = 'rules' AND indexname = 'idx_rules_signature';
-- =============================================================================
