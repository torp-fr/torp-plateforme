-- ============================================================================
-- MIGRATION: Complete fix for knowledge base tables
-- Purpose: Recreate KB tables with correct schema if needed
-- ============================================================================

-- Step 1: Drop existing tables if they exist (for clean start)
-- Comment out if you want to preserve existing data
-- DROP TABLE IF EXISTS knowledge_vectors CASCADE;
-- DROP TABLE IF EXISTS knowledge_document_sections CASCADE;
-- DROP TABLE IF EXISTS knowledge_documents CASCADE;

-- Step 2: Create knowledge_documents with correct schema
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
  source TEXT NOT NULL CHECK (source IN ('internal', 'external', 'official')),
  source_url TEXT,
  authority TEXT NOT NULL CHECK (authority IN ('official', 'expert', 'community', 'generated')),
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

-- Step 3: Create indexes
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

-- Step 6: Create knowledge_document_sections
CREATE TABLE IF NOT EXISTS knowledge_document_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level >= 1 AND level <= 6),
  content TEXT NOT NULL,
  keywords TEXT[],
  
  related_sections UUID[],
  
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sections_document ON knowledge_document_sections(document_id);
CREATE INDEX IF NOT EXISTS idx_sections_keywords ON knowledge_document_sections USING gin(keywords);

-- Enable RLS
ALTER TABLE knowledge_document_sections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Everyone can read sections of approved documents" ON knowledge_document_sections
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM knowledge_documents 
        WHERE knowledge_documents.id = knowledge_document_sections.document_id
        AND (
          knowledge_documents.approved_at IS NOT NULL 
          OR auth.uid() = knowledge_documents.created_by
          OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'super_admin')
          )
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 7: Create knowledge_vectors
CREATE TABLE IF NOT EXISTS knowledge_vectors (
  id TEXT PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  
  embedding vector(1536),
  content_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  
  UNIQUE(document_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_vectors_embedding ON knowledge_vectors USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_vectors_document ON knowledge_vectors(document_id);

-- Step 8: Create knowledge_queries_log
CREATE TABLE IF NOT EXISTS knowledge_queries_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  query_text TEXT NOT NULL,
  work_type TEXT,
  results_count INTEGER,
  search_duration_ms INTEGER,
  
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queries_created ON knowledge_queries_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queries_user ON knowledge_queries_log(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_work_type ON knowledge_queries_log(work_type);

-- ============================================================================
-- VERIFICATION QUERIES (uncomment to test after migration)
-- ============================================================================

-- Check tables exist:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name LIKE 'knowledge_%';

-- Check columns:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'knowledge_documents' ORDER BY ordinal_position;

-- ============================================================================
-- END MIGRATION
-- ============================================================================
