-- ============================================================================
-- MIGRATION: Nuclear Reset - Complete KB Schema Rebuild
-- Purpose: Start fresh with proven working schema
-- ============================================================================

-- STEP 1: Drop old table completely if it exists
DROP TABLE IF EXISTS knowledge_documents CASCADE;

-- STEP 2: Recreate with minimal, working schema
CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic document info
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,

  -- Classification
  category TEXT NOT NULL,
  work_types TEXT[],
  tags TEXT[],

  -- Metadata
  source TEXT,
  source_url TEXT,
  authority TEXT,
  confidence_score INTEGER DEFAULT 50,

  -- Content structure
  summary TEXT,
  key_points TEXT[],

  -- Relationships
  related_documents UUID[],
  embedding_id TEXT,

  -- Dates
  published_date TIMESTAMP,
  last_updated_date TIMESTAMP DEFAULT now(),
  version TEXT,

  -- Audit trail
  created_by UUID,
  created_at TIMESTAMP DEFAULT now(),
  approved_by UUID,
  approved_at TIMESTAMP,

  -- Timestamps
  updated_at TIMESTAMP DEFAULT now()
);

-- STEP 3: Add constraints after table creation (simpler, more reliable)
ALTER TABLE knowledge_documents
  ADD CONSTRAINT valid_category CHECK (category IN (
    'DTU', 'EUROCODE', 'NORM', 'REGULATION',
    'GUIDELINE', 'BEST_PRACTICE', 'TECHNICAL_GUIDE',
    'TRAINING', 'MANUAL', 'HANDBOOK',
    'SUSTAINABILITY', 'ENERGY_EFFICIENCY',
    'LEGAL', 'LIABILITY', 'WARRANTY',
    'CASE_STUDY', 'LESSONS_LEARNED'
  )),
  ADD CONSTRAINT valid_source CHECK (source IN ('internal', 'external', 'official')),
  ADD CONSTRAINT valid_authority CHECK (authority IN ('official', 'expert', 'community', 'generated')),
  ADD CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 100);

-- STEP 4: Create essential indexes
CREATE INDEX idx_kb_category ON knowledge_documents(category);
CREATE INDEX idx_kb_work_types ON knowledge_documents USING gin(work_types);
CREATE INDEX idx_kb_tags ON knowledge_documents USING gin(tags);
CREATE INDEX idx_kb_source ON knowledge_documents(source);
CREATE INDEX idx_kb_confidence ON knowledge_documents(confidence_score DESC);
CREATE INDEX idx_kb_created ON knowledge_documents(created_at DESC);
CREATE INDEX idx_kb_approved ON knowledge_documents(approved_at DESC);

-- STEP 5: Enable RLS
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

-- STEP 6: Create RLS Policies (one at a time for reliability)
CREATE POLICY rls_kb_read ON knowledge_documents
  FOR SELECT
  USING (approved_at IS NOT NULL);

CREATE POLICY rls_kb_insert_admin ON knowledge_documents
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY rls_kb_update_admin ON knowledge_documents
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY rls_kb_delete_admin ON knowledge_documents
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- STEP 7: Add foreign key references (at the end to avoid circular issues)
ALTER TABLE knowledge_documents
  ADD CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_approved_by FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- VERIFICATION: Confirm table and columns exist
-- Run this after migration to verify:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'knowledge_documents' ORDER BY ordinal_position;

-- ============================================================================
-- END MIGRATION
-- ============================================================================
