-- PHASE 35: Knowledge Brain - Analysis Learning Feedback
-- Store user corrections and feedback to improve future analyses

CREATE TABLE IF NOT EXISTS analysis_learning_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id UUID NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  analysis_id TEXT,                        -- Reference to specific TORP analysis
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL,             -- 'price_correction', 'missing_risk', 'false_positive', 'incomplete'
  user_feedback TEXT,                      -- User's written feedback
  correction_data JSONB DEFAULT '{}',      -- Structured corrections
  original_analysis JSONB,                 -- Snapshot of original analysis
  confidence_score INTEGER DEFAULT 50,     -- How confident are we in this correction
  is_verified BOOLEAN DEFAULT false,       -- Verified by admin or second user
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT feedback_type_valid CHECK (
    feedback_type IN ('price_correction', 'missing_risk', 'false_positive', 'incomplete', 'other')
  ),
  CONSTRAINT confidence_score_range CHECK (confidence_score >= 0 AND confidence_score <= 100)
);

-- Indexes for efficient queries
CREATE INDEX idx_analysis_learning_feedback_devis_id ON analysis_learning_feedback(devis_id);
CREATE INDEX idx_analysis_learning_feedback_user_id ON analysis_learning_feedback(user_id);
CREATE INDEX idx_analysis_learning_feedback_type ON analysis_learning_feedback(feedback_type);
CREATE INDEX idx_analysis_learning_feedback_verified ON analysis_learning_feedback(is_verified);
CREATE INDEX idx_analysis_learning_feedback_created_at ON analysis_learning_feedback(created_at DESC);

-- RLS Policies
ALTER TABLE analysis_learning_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analysis_learning_feedback_read_own_or_admin" ON analysis_learning_feedback
  FOR SELECT USING (
    auth.uid() = user_id OR
    (auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    ))
  );

CREATE POLICY "analysis_learning_feedback_insert_authenticated" ON analysis_learning_feedback
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND auth.uid() = user_id
  );

CREATE POLICY "analysis_learning_feedback_update_own" ON analysis_learning_feedback
  FOR UPDATE USING (
    auth.uid() = user_id AND is_verified = false
  );

CREATE POLICY "analysis_learning_feedback_update_admin" ON analysis_learning_feedback
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_analysis_learning_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_analysis_learning_feedback_updated_at
  BEFORE UPDATE ON analysis_learning_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_analysis_learning_feedback_updated_at();

-- Helper function to get learning insights
CREATE OR REPLACE FUNCTION get_learning_insights(
  p_type_travaux TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  feedback_type TEXT,
  count BIGINT,
  avg_confidence NUMERIC
) AS $$
SELECT
  feedback_type,
  COUNT(*) as count,
  AVG(confidence_score)::NUMERIC as avg_confidence
FROM analysis_learning_feedback
WHERE
  is_verified = true
  AND (p_type_travaux IS NULL OR devis_id IN (
    SELECT d.id FROM devis d
    WHERE d.type_travaux = p_type_travaux
  ))
  AND (p_region IS NULL OR devis_id IN (
    SELECT d.id FROM devis d
    WHERE d.region = p_region
  ))
GROUP BY feedback_type
ORDER BY count DESC
LIMIT p_limit;
$$ LANGUAGE sql;
