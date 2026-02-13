-- ============================================================================
-- MIGRATION: Ensure complete KB schema exists with all columns
-- Purpose: Comprehensive migration to guarantee proper schema
-- ============================================================================

-- Step 1: Ensure knowledge_documents table exists with all required columns
-- Check if table exists, if not create it with complete schema
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,

  -- Classification
  category TEXT NOT NULL CHECK (category IN (
    'DTU', 'EUROCODE', 'NORM', 'REGULATION',
    'GUIDELINE', 'BEST_PRACTICE', 'TECHNICAL_GUIDE',
    'TRAINING', 'MANUAL', 'HANDBOOK',
    'SUSTAINABILITY', 'ENERGY_EFFICIENCY',
    'LEGAL', 'LIABILITY', 'WARRANTY',
    'CASE_STUDY', 'LESSONS_LEARNED'
  )),
  work_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Metadata
  source TEXT NOT NULL DEFAULT 'internal' CHECK (source IN ('internal', 'external', 'official')),
  source_url TEXT,
  authority TEXT NOT NULL DEFAULT 'community' CHECK (authority IN ('official', 'expert', 'community', 'generated')),
  confidence_score INTEGER DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100),

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

  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now(),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,

  -- Search optimization
  fts_document tsvector GENERATED ALWAYS AS (
    to_tsvector('french', title || ' ' || COALESCE(content, ''))
  ) STORED
);

-- Step 2: Add missing columns to existing table (if it was partially created)
DO $$ BEGIN
  ALTER TABLE knowledge_documents ADD COLUMN work_types TEXT[] DEFAULT ARRAY[]::TEXT[];
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_documents ADD COLUMN tags TEXT[] DEFAULT ARRAY[]::TEXT[];
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_documents ADD COLUMN source TEXT DEFAULT 'internal' CHECK (source IN ('internal', 'external', 'official'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_documents ADD COLUMN authority TEXT DEFAULT 'community' CHECK (authority IN ('official', 'expert', 'community', 'generated'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_documents ADD COLUMN confidence_score INTEGER DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_documents ADD COLUMN related_documents UUID[];
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_documents ADD COLUMN summary TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_documents ADD COLUMN key_points TEXT[];
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_documents ADD COLUMN embedding_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_documents ADD COLUMN published_date TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_documents ADD COLUMN last_updated_date TIMESTAMP DEFAULT now();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_documents ADD COLUMN version TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_documents ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_documents ADD COLUMN approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_documents ADD COLUMN approved_at TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Step 3: Create all necessary indexes
CREATE INDEX IF NOT EXISTS idx_kb_documents_category ON knowledge_documents(category);
CREATE INDEX IF NOT EXISTS idx_kb_documents_work_types ON knowledge_documents USING gin(work_types);
CREATE INDEX IF NOT EXISTS idx_kb_documents_tags ON knowledge_documents USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_kb_documents_source ON knowledge_documents(source);
CREATE INDEX IF NOT EXISTS idx_kb_documents_confidence ON knowledge_documents(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_kb_documents_fts ON knowledge_documents USING gin(fts_document);
CREATE INDEX IF NOT EXISTS idx_kb_documents_created ON knowledge_documents(created_at DESC);

-- Step 4: Enable RLS
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS Policies
DO $$ BEGIN
  CREATE POLICY "Everyone can read approved knowledge documents" ON knowledge_documents
    FOR SELECT USING (
      approved_at IS NOT NULL OR
      auth.uid() = created_by OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can insert knowledge documents" ON knowledge_documents
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
        AND profiles.can_upload_kb = TRUE
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update knowledge documents" ON knowledge_documents
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete knowledge documents" ON knowledge_documents
    FOR DELETE USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- END MIGRATION
-- ============================================================================
