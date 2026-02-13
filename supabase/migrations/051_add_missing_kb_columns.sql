-- ============================================================================
-- MIGRATION: Add missing columns to knowledge_documents table
-- Purpose: Fix incomplete schema by adding missing columns one by one
-- ============================================================================

-- Step 1: Add work_types column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE knowledge_documents
  ADD COLUMN work_types TEXT[] DEFAULT ARRAY[]::TEXT[];
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE 'Column work_types already exists';
END $$;

-- Step 2: Add tags column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE knowledge_documents
  ADD COLUMN tags TEXT[] DEFAULT ARRAY[]::TEXT[];
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE 'Column tags already exists';
END $$;

-- Step 3: Add source column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE knowledge_documents
  ADD COLUMN source TEXT CHECK (source IN ('internal', 'external', 'official'));
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE 'Column source already exists';
END $$;

-- Step 4: Add authority column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE knowledge_documents
  ADD COLUMN authority TEXT CHECK (authority IN ('official', 'expert', 'community', 'generated'));
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE 'Column authority already exists';
END $$;

-- Step 5: Add confidence_score column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE knowledge_documents
  ADD COLUMN confidence_score INTEGER DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100);
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE 'Column confidence_score already exists';
END $$;

-- Step 6: Add related_documents column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE knowledge_documents
  ADD COLUMN related_documents UUID[];
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE 'Column related_documents already exists';
END $$;

-- Step 7: Add category column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE knowledge_documents
  ADD COLUMN category TEXT CHECK (category IN (
    'DTU', 'EUROCODE', 'NORM', 'REGULATION',
    'GUIDELINE', 'BEST_PRACTICE', 'TECHNICAL_GUIDE',
    'TRAINING', 'MANUAL', 'HANDBOOK',
    'SUSTAINABILITY', 'ENERGY_EFFICIENCY',
    'LEGAL', 'LIABILITY', 'WARRANTY',
    'CASE_STUDY', 'LESSONS_LEARNED'
  ));
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE 'Column category already exists';
END $$;

-- Step 8: Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_kb_documents_work_types ON knowledge_documents USING gin(work_types);
CREATE INDEX IF NOT EXISTS idx_kb_documents_tags ON knowledge_documents USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_kb_documents_category ON knowledge_documents(category);
CREATE INDEX IF NOT EXISTS idx_kb_documents_source ON knowledge_documents(source);
CREATE INDEX IF NOT EXISTS idx_kb_documents_confidence ON knowledge_documents(confidence_score DESC);

-- ============================================================================
-- END MIGRATION
-- ============================================================================
