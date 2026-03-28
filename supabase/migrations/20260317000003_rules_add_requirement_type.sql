-- =============================================================================
-- MIGRATION: Add 'requirement' to rules.rule_type check constraint
-- Date: 2026-03-17
-- Description: The qualitative extraction path produces rules with
--              rule_type = 'requirement'. The existing CHECK constraint
--              must be widened to allow it.
-- Safe to run multiple times (DROP CONSTRAINT IF EXISTS).
-- =============================================================================

-- PostgreSQL does not support ALTER CONSTRAINT — must drop and re-add.
ALTER TABLE public.rules
  DROP CONSTRAINT IF EXISTS rules_rule_type_check;

ALTER TABLE public.rules
  ADD CONSTRAINT rules_rule_type_check
    CHECK (rule_type IN ('constraint', 'formula', 'recommendation', 'price', 'requirement'));

-- =============================================================================
-- VERIFY
-- =============================================================================
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM   pg_constraint
WHERE  conrelid = 'public.rules'::regclass
  AND  conname  = 'rules_rule_type_check';
-- Expected: "CHECK (rule_type = ANY (ARRAY['constraint'::text, ..., 'requirement'::text]))"
