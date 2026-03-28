-- =============================================================================
-- MIGRATION: Rule Extraction Layer
-- Date: 2026-03-17
-- Description: Adds rule_processed column to knowledge_chunks and creates the
--              rules table for the deterministic DTU rule extraction pipeline.
-- =============================================================================

-- =============================================================================
-- STEP 0 — BACKUP INSTRUCTIONS (run these BEFORE applying this migration)
-- =============================================================================
--
-- 1. Backup knowledge_documents:
--    pg_dump --table=knowledge_documents \
--      --data-only --no-owner \
--      "$DATABASE_URL" > backup_knowledge_documents_$(date +%Y%m%d_%H%M%S).sql
--
-- 2. Backup knowledge_chunks:
--    pg_dump --table=knowledge_chunks \
--      --data-only --no-owner \
--      "$DATABASE_URL" > backup_knowledge_chunks_$(date +%Y%m%d_%H%M%S).sql
--
-- 3. (Optional) Quick row count verification after restore:
--    SELECT COUNT(*) FROM knowledge_documents;
--    SELECT COUNT(*) FROM knowledge_chunks;
--
-- =============================================================================

-- =============================================================================
-- STEP 0 — ADD PROCESSING FLAG TO knowledge_chunks
-- =============================================================================

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS rule_processed BOOLEAN NOT NULL DEFAULT FALSE;

-- Index to make the worker fetch query fast (filters on rule_processed + category join)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_rule_processed
  ON knowledge_chunks (rule_processed)
  WHERE rule_processed = FALSE;

-- =============================================================================
-- STEP 1 — CREATE rules TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS rules (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  document_id      UUID        REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_id         UUID        REFERENCES knowledge_chunks(id)    ON DELETE CASCADE,

  -- Classification
  category         TEXT,                                -- e.g. 'DTU'
  domain           TEXT,                                -- e.g. 'plomberie', 'structure'

  -- Rule kind: constraint | formula | recommendation | price
  rule_type        TEXT        NOT NULL CHECK (rule_type IN ('constraint', 'formula', 'recommendation', 'price')),

  -- Human-readable description (truncated source sentence)
  description      TEXT        NOT NULL,

  -- Machine-readable extraction result
  structured_data  JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Extraction confidence [0.0 – 1.0]
  confidence_score FLOAT       NOT NULL DEFAULT 0.5
                               CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),

  -- Source sentence verbatim (for audit / re-extraction)
  source           TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_rules_chunk_id
  ON rules (chunk_id);

CREATE INDEX IF NOT EXISTS idx_rules_category
  ON rules (category);

CREATE INDEX IF NOT EXISTS idx_rules_rule_type
  ON rules (rule_type);

CREATE INDEX IF NOT EXISTS idx_rules_domain
  ON rules (domain);

-- GIN index for structured_data JSON queries
CREATE INDEX IF NOT EXISTS idx_rules_structured_data_gin
  ON rules USING GIN (structured_data);

-- Composite index for the most common worker query pattern
CREATE INDEX IF NOT EXISTS idx_rules_category_domain
  ON rules (category, domain);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE rules IS
  'Deterministically extracted rules from DTU knowledge chunks. '
  'Populated by the ruleExtraction worker. One chunk may produce 0..N rules.';

COMMENT ON COLUMN rules.rule_type IS
  'constraint = numeric bound (min/max), '
  'formula = calculation rule, '
  'recommendation = best practice, '
  'price = pricing reference';

COMMENT ON COLUMN rules.structured_data IS
  'JSON: { property, operator, value, unit, raw }. '
  'Operator is one of: >=, <=, =, >, <, range, unknown.';

COMMENT ON COLUMN rules.confidence_score IS
  '0.85 = numeric + known property, '
  '0.70 = numeric only, '
  '0.60 = known property only, '
  '0.50 = keyword detection only';

COMMENT ON COLUMN knowledge_chunks.rule_processed IS
  'Set to TRUE once the ruleExtraction worker has processed this chunk. '
  'Only DTU category chunks are processed; all others remain FALSE by design.';
