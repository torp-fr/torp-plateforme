-- =============================================================================
-- MIGRATION: Add enforcement metadata columns to public.rules
-- Date: 2026-03-17
-- Description: Extends the rules table with four new columns that support
--              context-aware, adaptive enforcement in the Analysis Engine.
--
--   enforcement_level  TEXT    — regulatory weight of the source document
--   flexibility_score  NUMERIC — 0 (strict) to 1 (flexible)
--   contextual         BOOLEAN — true when rule depends on context
--   applicability      JSONB   — structured applicability conditions
--
-- Safe to run multiple times (ALTER ... IF NOT EXISTS / ADD CONSTRAINT IF NOT EXISTS).
-- =============================================================================

-- 1. enforcement_level --------------------------------------------------------

ALTER TABLE public.rules
  ADD COLUMN IF NOT EXISTS enforcement_level TEXT
    NOT NULL DEFAULT 'normative';

-- Check constraint (drop-first pattern for idempotency)
ALTER TABLE public.rules
  DROP CONSTRAINT IF EXISTS rules_enforcement_level_check;

ALTER TABLE public.rules
  ADD CONSTRAINT rules_enforcement_level_check
    CHECK (enforcement_level IN (
      'strict',
      'normative',
      'recommended',
      'adaptive',
      'informative'
    ));

-- 2. flexibility_score --------------------------------------------------------

ALTER TABLE public.rules
  ADD COLUMN IF NOT EXISTS flexibility_score NUMERIC(3, 2)
    NOT NULL DEFAULT 0.3;

ALTER TABLE public.rules
  DROP CONSTRAINT IF EXISTS rules_flexibility_score_check;

ALTER TABLE public.rules
  ADD CONSTRAINT rules_flexibility_score_check
    CHECK (flexibility_score >= 0 AND flexibility_score <= 1);

-- 3. contextual ---------------------------------------------------------------

ALTER TABLE public.rules
  ADD COLUMN IF NOT EXISTS contextual BOOLEAN
    NOT NULL DEFAULT false;

-- 4. applicability ------------------------------------------------------------

ALTER TABLE public.rules
  ADD COLUMN IF NOT EXISTS applicability JSONB
    NOT NULL DEFAULT '{}'::jsonb;

-- 5. Indexes ------------------------------------------------------------------

-- Filter by enforcement level (e.g. fetch only strict rules for a domain)
CREATE INDEX IF NOT EXISTS idx_rules_enforcement_level
  ON public.rules (enforcement_level);

-- Filter contextual rules separately (engine may skip them when context missing)
CREATE INDEX IF NOT EXISTS idx_rules_contextual
  ON public.rules (contextual);

-- GIN index for JSONB applicability queries
-- (e.g. WHERE applicability @> '{"project_type":"neuf"}')
CREATE INDEX IF NOT EXISTS idx_rules_applicability_gin
  ON public.rules USING GIN (applicability);

-- =============================================================================
-- BACKFILL — set correct defaults for existing rows
-- All current rows are from DTU documents → normative / 0.3 / false / {}
-- =============================================================================

UPDATE public.rules
SET
  enforcement_level = 'normative',
  flexibility_score = 0.3,
  contextual        = false,
  applicability     = '{}'::jsonb
WHERE enforcement_level = 'normative'   -- only rows still at default
  AND flexibility_score = 0.3
  AND contextual        = false;

-- =============================================================================
-- VERIFY
-- =============================================================================
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'rules'
  AND column_name IN (
    'enforcement_level',
    'flexibility_score',
    'contextual',
    'applicability'
  )
ORDER BY ordinal_position;
-- Expected: 4 rows, all matching the types above
