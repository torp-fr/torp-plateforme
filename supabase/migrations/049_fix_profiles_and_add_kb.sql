-- ============================================================================
-- MIGRATION: Create profiles table and add roles + KB tables
-- Purpose: Fix missing profiles table and add admin/KB functionality
-- ============================================================================

-- ============================================================================
-- TABLE: profiles (if not exists)
-- Create base profiles table for all users
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  company_name TEXT,
  company_siret TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'FR',

  -- Role-based access control (new)
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  is_admin BOOLEAN DEFAULT FALSE,
  can_upload_kb BOOLEAN DEFAULT FALSE,
  created_role_date TIMESTAMP,
  updated_role_date TIMESTAMP,

  -- Profile completion tracking
  profile_complete BOOLEAN DEFAULT FALSE,
  completion_percentage INTEGER DEFAULT 0,

  -- Preferences
  language TEXT DEFAULT 'fr',
  notifications_enabled BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_company_siret ON profiles(company_siret);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Existing RLS policies (if not exists)
DO $$ BEGIN
  CREATE POLICY "users_can_read_own_profile" ON profiles
    FOR SELECT USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "users_can_update_own_profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "users_can_insert_own_profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLE: knowledge_documents
-- Store domain expertise documents (DTU, standards, guidelines, etc.)
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_kb_documents_category ON knowledge_documents(category);
CREATE INDEX IF NOT EXISTS idx_kb_documents_work_types ON knowledge_documents USING gin(work_types);
CREATE INDEX IF NOT EXISTS idx_kb_documents_source ON knowledge_documents(source);
CREATE INDEX IF NOT EXISTS idx_kb_documents_confidence ON knowledge_documents(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_kb_documents_fts ON knowledge_documents USING gin(fts_document);
CREATE INDEX IF NOT EXISTS idx_kb_documents_created ON knowledge_documents(created_at DESC);

-- Enable RLS
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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
-- TABLE: knowledge_document_sections
-- Store structured content sections
-- ============================================================================
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

-- RLS for sections
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

-- ============================================================================
-- TABLE: knowledge_vectors
-- Store vector embeddings for RAG
-- ============================================================================
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

-- ============================================================================
-- TABLE: knowledge_queries_log
-- Analytics for knowledge base usage
-- ============================================================================
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
-- TABLE: admin_audit_log
-- Track admin actions on knowledge base and user management
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  action TEXT NOT NULL CHECK (action IN (
    'document_upload', 'document_approve', 'document_reject', 'document_delete',
    'user_role_change', 'user_kb_permission_change', 'user_create', 'user_delete'
  )),
  target_id UUID,
  target_type TEXT,
  details JSONB,
  
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
DO $$ BEGIN
  CREATE POLICY "Admins can view audit logs" ON admin_audit_log
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'super_admin')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- FUNCTIONS: Role management
-- ============================================================================

-- Function to promote user to admin
CREATE OR REPLACE FUNCTION promote_user_to_admin(user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles 
  SET 
    role = 'admin',
    is_admin = TRUE,
    can_upload_kb = TRUE,
    updated_role_date = now()
  WHERE id = user_id;
  
  -- Log the action
  INSERT INTO admin_audit_log (admin_id, action, target_id, target_type, details)
  VALUES (
    auth.uid(),
    'user_role_change',
    user_id,
    'user',
    jsonb_build_object('new_role', 'admin', 'old_role', 'user')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to demote admin to user
CREATE OR REPLACE FUNCTION demote_admin_to_user(user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles 
  SET 
    role = 'user',
    is_admin = FALSE,
    can_upload_kb = FALSE,
    updated_role_date = now()
  WHERE id = user_id;
  
  -- Log the action
  INSERT INTO admin_audit_log (admin_id, action, target_id, target_type, details)
  VALUES (
    auth.uid(),
    'user_role_change',
    user_id,
    'user',
    jsonb_build_object('new_role', 'user', 'old_role', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user is admin
CREATE OR REPLACE FUNCTION is_user_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- END MIGRATION
-- ============================================================================
