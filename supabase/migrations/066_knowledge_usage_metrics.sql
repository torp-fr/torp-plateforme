-- PHASE 36: Knowledge Usage Metrics - Track document impact
-- Table to track when and how documents are used in analysis

CREATE TABLE IF NOT EXISTS knowledge_usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  analysis_id TEXT,                          -- Reference to TORP analysis
  devis_id UUID REFERENCES devis(id) ON DELETE SET NULL,
  impact_score INTEGER DEFAULT 1,            -- How much did this doc impact the analysis
  category_used TEXT,                        -- Which category matched
  region_matched TEXT,                       -- Region match if applicable
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT impact_score_range CHECK (impact_score >= 0 AND impact_score <= 100)
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_usage_document_id ON knowledge_usage_metrics(document_id);
CREATE INDEX IF NOT EXISTS idx_usage_devis_id ON knowledge_usage_metrics(devis_id);
CREATE INDEX IF NOT EXISTS idx_usage_created_at ON knowledge_usage_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_impact_score ON knowledge_usage_metrics(impact_score DESC);

-- RLS Policies
ALTER TABLE knowledge_usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read usage metrics"
ON knowledge_usage_metrics FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated write usage metrics"
ON knowledge_usage_metrics FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow admin delete usage metrics"
ON knowledge_usage_metrics FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  )
);

-- View for analytics: Knowledge impact summary
CREATE OR REPLACE VIEW knowledge_impact_summary AS
SELECT
  kd.id,
  kd.source,
  kd.category,
  COUNT(kum.id) as total_uses,
  AVG(kum.impact_score) as avg_impact,
  MAX(kum.created_at) as last_used,
  kd.usage_count,
  kd.quality_score
FROM knowledge_documents kd
LEFT JOIN knowledge_usage_metrics kum ON kd.id = kum.document_id
WHERE kd.is_active = true
GROUP BY kd.id, kd.source, kd.category, kd.usage_count, kd.quality_score;

-- Helper function to update usage count
CREATE OR REPLACE FUNCTION update_knowledge_usage_count(p_document_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE knowledge_documents
  SET
    usage_count = (
      SELECT COUNT(*) FROM knowledge_usage_metrics
      WHERE document_id = p_document_id
    ),
    last_used_at = NOW()
  WHERE id = p_document_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function to detect low quality documents
CREATE OR REPLACE FUNCTION detect_low_quality_documents()
RETURNS TABLE(document_id UUID, reason TEXT) AS $$
SELECT
  id as document_id,
  CASE
    WHEN usage_count = 0 AND created_at < NOW() - INTERVAL '7 days'
      THEN 'Never used after 7 days'
    WHEN quality_score < 30
      THEN 'Low quality score'
    WHEN reliability_score < 40
      THEN 'Low reliability'
    ELSE 'Other quality issue'
  END as reason
FROM knowledge_documents
WHERE is_active = true
  AND (
    (usage_count = 0 AND created_at < NOW() - INTERVAL '7 days')
    OR quality_score < 30
    OR reliability_score < 40
  );
$$ LANGUAGE sql;
