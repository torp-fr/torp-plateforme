-- PHASE 36: Knowledge Governance Engine - Add governance columns
-- Add quality scoring and usage tracking to knowledge_documents

ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 50 CHECK (quality_score >= 0 AND quality_score <= 100);
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0);
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1 CHECK (version_number > 0);
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES knowledge_documents(id) ON DELETE SET NULL;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS is_superseded BOOLEAN DEFAULT false;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS is_low_quality BOOLEAN DEFAULT false;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_quality_score ON knowledge_documents(quality_score DESC, is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_usage_count ON knowledge_documents(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_last_used_at ON knowledge_documents(last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_superseded ON knowledge_documents(is_superseded, parent_document_id);

-- Trigger to update updated_at when version changes
CREATE OR REPLACE FUNCTION update_knowledge_version_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.version_number > OLD.version_number THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_knowledge_version_timestamp
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW
  WHEN (NEW.version_number IS DISTINCT FROM OLD.version_number)
  EXECUTE FUNCTION update_knowledge_version_timestamp();

-- Comments for documentation
COMMENT ON COLUMN knowledge_documents.quality_score IS 'Calculated score (0-100) based on authority, recency, usage, and feedback';
COMMENT ON COLUMN knowledge_documents.usage_count IS 'Number of times used in analysis';
COMMENT ON COLUMN knowledge_documents.version_number IS 'Document version for tracking updates';
COMMENT ON COLUMN knowledge_documents.is_superseded IS 'TRUE if replaced by newer version';
COMMENT ON COLUMN knowledge_documents.is_low_quality IS 'TRUE if quality issues detected';
