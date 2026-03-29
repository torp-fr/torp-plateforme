-- =============================================================================
-- Migration: Contextual interpretation fields on public.rules
-- Date: 2026-03-20
--
-- Extends the rules table with five fields that transform binary constraints
-- into contextual decision units.  These fields are computed at enrichment
-- time by ruleEnrichment.service.ts and stored for fast retrieval by the
-- analysis engine.
--
--   strictness             — regulatory weight, granular (very_high → low)
--   tolerance              — acceptable deviation for dimensional rules (JSONB)
--   adaptable              — whether a derogation path exists for this rule
--   risk_level             — project risk if this rule is not respected
--   justification_required — whether non-compliance requires written justification
--
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- =============================================================================
-- 1. strictness
-- =============================================================================

ALTER TABLE public.rules
  ADD COLUMN IF NOT EXISTS strictness TEXT NOT NULL DEFAULT 'high';

ALTER TABLE public.rules
  DROP CONSTRAINT IF EXISTS rules_strictness_check;

ALTER TABLE public.rules
  ADD CONSTRAINT rules_strictness_check
    CHECK (strictness IN ('very_high', 'high', 'medium', 'low'));

COMMENT ON COLUMN public.rules.strictness IS
  'Regulatory weight of the rule, derived from document category. '
  'very_high = CODE_CONSTRUCTION / EUROCODE (law + structural safety). '
  'high = DTU / NORMES (contractual / certification). '
  'medium = GUIDE_TECHNIQUE (best practice).';

-- =============================================================================
-- 2. tolerance
-- =============================================================================

ALTER TABLE public.rules
  ADD COLUMN IF NOT EXISTS tolerance JSONB;

COMMENT ON COLUMN public.rules.tolerance IS
  'Acceptable deviation for dimensional constraints. '
  'NULL for non-dimensional rules. '
  'Schema: { value: number, unit: string, percentage: number, basis: string }. '
  'Computed as 5% (very_high / high) or 10% (medium) of the nominal value.';

-- =============================================================================
-- 3. adaptable
-- =============================================================================

ALTER TABLE public.rules
  ADD COLUMN IF NOT EXISTS adaptable BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.rules.adaptable IS
  'True when a legitimate derogation path exists (ATec, equivalent performance, '
  'technical justification). False for statutory / structural rules.';

-- =============================================================================
-- 4. risk_level
-- =============================================================================

ALTER TABLE public.rules
  ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'medium';

ALTER TABLE public.rules
  DROP CONSTRAINT IF EXISTS rules_risk_level_check;

ALTER TABLE public.rules
  ADD CONSTRAINT rules_risk_level_check
    CHECK (risk_level IN ('low', 'medium', 'high'));

COMMENT ON COLUMN public.rules.risk_level IS
  'Project risk if this rule is not respected. '
  'high = structural / legal consequence (EUROCODE, CODE_CONSTRUCTION, non-contextual DTU). '
  'medium = quality / compliance defect (NORMES, contextual DTU, GUIDE_TECHNIQUE). '
  'low = best-practice deviation only.';

-- =============================================================================
-- 5. justification_required
-- =============================================================================

ALTER TABLE public.rules
  ADD COLUMN IF NOT EXISTS justification_required BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.rules.justification_required IS
  'True when non-compliance must be justified in writing (DTU, NORMES). '
  'False for statutory rules (no justification replaces legal compliance) '
  'and for advisory rules (no justification required).';

-- =============================================================================
-- 6. Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_rules_strictness
  ON public.rules (strictness);

CREATE INDEX IF NOT EXISTS idx_rules_risk_level
  ON public.rules (risk_level);

CREATE INDEX IF NOT EXISTS idx_rules_adaptable
  ON public.rules (adaptable);

-- GIN index for tolerance JSONB queries
CREATE INDEX IF NOT EXISTS idx_rules_tolerance_gin
  ON public.rules USING GIN (tolerance)
  WHERE tolerance IS NOT NULL;

-- =============================================================================
-- 7. Backfill existing rows by category
--
-- New rows get correct values from the enrichment service at write time.
-- Existing rows must be backfilled from their stored category column.
-- The contextual column (already present from migration 20260317000004) is
-- used to compute risk_level for high-strictness categories.
-- =============================================================================

-- ── EUROCODE ──────────────────────────────────────────────────────────────────
UPDATE public.rules
SET
  strictness             = 'very_high',
  adaptable              = false,
  risk_level             = 'high',
  justification_required = false
WHERE category = 'EUROCODE';

-- ── CODE_CONSTRUCTION ─────────────────────────────────────────────────────────
UPDATE public.rules
SET
  strictness             = 'very_high',
  adaptable              = false,
  risk_level             = 'high',
  justification_required = false
WHERE category = 'CODE_CONSTRUCTION';

-- ── DTU ───────────────────────────────────────────────────────────────────────
-- Non-contextual DTU rules carry full execution risk (high).
-- Contextual DTU rules apply only in specific conditions (medium).
UPDATE public.rules
SET
  strictness             = 'high',
  adaptable              = true,
  risk_level             = CASE WHEN contextual THEN 'medium' ELSE 'high' END,
  justification_required = true
WHERE category = 'DTU';

-- ── NORMES ────────────────────────────────────────────────────────────────────
UPDATE public.rules
SET
  strictness             = 'high',
  adaptable              = false,
  risk_level             = 'medium',
  justification_required = true
WHERE category = 'NORMES';

-- ── GUIDE_TECHNIQUE ───────────────────────────────────────────────────────────
UPDATE public.rules
SET
  strictness             = 'medium',
  adaptable              = true,
  risk_level             = 'low',
  justification_required = false
WHERE category = 'GUIDE_TECHNIQUE';

-- =============================================================================
-- 8. Verify
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
    'strictness', 'tolerance', 'adaptable', 'risk_level', 'justification_required'
  )
ORDER BY ordinal_position;
-- Expected: 5 rows
