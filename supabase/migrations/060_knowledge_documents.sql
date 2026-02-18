-- PHASE 35: Knowledge Brain - Documents Storage
-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Table for storing knowledge documents
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                    -- 'market_survey', 'regulatory', 'user_feedback', etc.
  category TEXT NOT NULL,                  -- 'pricing', 'regulations', 'best_practices', 'warnings'
  region TEXT,                              -- Region this knowledge applies to (nullable for global)
  content TEXT NOT NULL,                   -- Document content/text
  metadata JSONB DEFAULT '{}',             -- Additional metadata
  reliability_score INTEGER DEFAULT 50,    -- 0-100 score for source reliability
  version INTEGER DEFAULT 1,                -- Document version for tracking updates
  is_active BOOLEAN DEFAULT true,          -- Soft delete capability
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT reliability_score_range CHECK (reliability_score >= 0 AND reliability_score <= 100),
  CONSTRAINT content_not_empty CHECK (content != '')
);

-- Index for faster queries
CREATE INDEX idx_knowledge_documents_source ON knowledge_documents(source);
CREATE INDEX idx_knowledge_documents_category ON knowledge_documents(category);
CREATE INDEX idx_knowledge_documents_region ON knowledge_documents(region);
CREATE INDEX idx_knowledge_documents_active ON knowledge_documents(is_active);
CREATE INDEX idx_knowledge_documents_reliability ON knowledge_documents(reliability_score DESC);

-- RLS Policies
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_documents_read_authenticated" ON knowledge_documents
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "knowledge_documents_insert_admin" ON knowledge_documents
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "knowledge_documents_update_admin" ON knowledge_documents
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "knowledge_documents_delete_admin" ON knowledge_documents
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_knowledge_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_knowledge_documents_updated_at
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_documents_updated_at();
