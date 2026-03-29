-- ============================================================
-- Migration: Add category to knowledge_chunks
-- Date: 2026-03-20
--
-- Problem: knowledge_chunks had no category column.
--   The ingestion worker wrote category to this table but the
--   column did not exist in the schema, silently discarding it.
--   The rule extraction worker fell back to 'DTU' for every chunk,
--   routing all rules to the DTU extractor regardless of source.
--
-- Solution:
--   1. Add category TEXT column (nullable during backfill)
--   2. Backfill from knowledge_documents via document_id FK
--   3. Set remaining NULLs to 'UNKNOWN' (orphaned / no-category docs)
--   4. Apply NOT NULL constraint
--   5. Add index for efficient per-category queries
--   6. Add comment for documentation
-- ============================================================

-- Step 1: Add column as nullable so existing rows are not rejected
ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS category TEXT;

-- Step 2: Backfill category from the parent document
--   All existing chunks get the category of their source document.
--   Runs only on rows where category is still NULL (idempotent).
UPDATE knowledge_chunks kc
SET    category = kd.category
FROM   knowledge_documents kd
WHERE  kc.document_id = kd.id
  AND  kc.category    IS NULL;

-- Step 3: Set a safe fallback for any chunk whose parent document
--   has no category (should not happen with well-formed data, but
--   prevents the NOT NULL constraint from failing on legacy rows).
UPDATE knowledge_chunks
SET    category = 'UNKNOWN'
WHERE  category IS NULL;

-- Step 4: Enforce NOT NULL — category is now required for every chunk
ALTER TABLE knowledge_chunks
  ALTER COLUMN category SET NOT NULL;

-- Step 5: Index for per-category queries used by the task runner
--   and rule extraction worker (WHERE category = $1)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_category
  ON knowledge_chunks (category);

-- Step 6: Documentation
COMMENT ON COLUMN knowledge_chunks.category IS
  'Propagated from knowledge_documents.category at ingestion time. '
  'Required for category-specific rule extraction. '
  'Never NULL — set to ''UNKNOWN'' when parent document has no category.';
