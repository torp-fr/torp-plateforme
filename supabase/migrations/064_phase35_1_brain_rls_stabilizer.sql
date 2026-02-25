-- PHASE 35.1: Brain Model Stabilizer - Ensure RLS Policies

-- Enable RLS on knowledge tables (if not already enabled)
ALTER TABLE IF EXISTS knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS knowledge_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS market_price_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS analysis_learning_feedback ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated read knowledge_documents" ON knowledge_documents;
DROP POLICY IF EXISTS "Allow admin insert knowledge_documents" ON knowledge_documents;
DROP POLICY IF EXISTS "Allow admin update knowledge_documents" ON knowledge_documents;
DROP POLICY IF EXISTS "Allow admin delete knowledge_documents" ON knowledge_documents;

DROP POLICY IF EXISTS "Allow authenticated read knowledge_embeddings" ON knowledge_embeddings;
DROP POLICY IF EXISTS "Allow admin manage knowledge_embeddings" ON knowledge_embeddings;

DROP POLICY IF EXISTS "Allow authenticated read market_price_references" ON market_price_references;
DROP POLICY IF EXISTS "Allow admin manage market_price_references" ON market_price_references;

DROP POLICY IF EXISTS "Allow user read own feedback" ON analysis_learning_feedback;
DROP POLICY IF EXISTS "Allow authenticated write feedback" ON analysis_learning_feedback;
DROP POLICY IF EXISTS "Allow admin manage feedback" ON analysis_learning_feedback;

-- KNOWLEDGE_DOCUMENTS Policies - Clarified
-- READ: Authenticated users can read all active documents
CREATE POLICY "Allow authenticated read knowledge_documents"
ON knowledge_documents FOR SELECT
TO authenticated
USING (is_active = true);

-- INSERT: Only admins
CREATE POLICY "Allow admin insert knowledge_documents"
ON knowledge_documents FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  )
);

-- UPDATE: Only admins
CREATE POLICY "Allow admin update knowledge_documents"
ON knowledge_documents FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  )
);

-- DELETE: Only admins
CREATE POLICY "Allow admin delete knowledge_documents"
ON knowledge_documents FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  )
);

-- KNOWLEDGE_EMBEDDINGS Policies
CREATE POLICY "Allow authenticated read knowledge_embeddings"
ON knowledge_embeddings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin manage knowledge_embeddings"
ON knowledge_embeddings FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  )
);

-- MARKET_PRICE_REFERENCES Policies
CREATE POLICY "Allow authenticated read market_price_references"
ON market_price_references FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Allow admin manage market_price_references"
ON market_price_references FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  )
);

-- ANALYSIS_LEARNING_FEEDBACK Policies
CREATE POLICY "Allow user read own feedback"
ON analysis_learning_feedback FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  )
);

CREATE POLICY "Allow authenticated write feedback"
ON analysis_learning_feedback FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow user update own unverified feedback"
ON analysis_learning_feedback FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND is_verified = false)
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow admin manage all feedback"
ON analysis_learning_feedback FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  )
);

-- Log that policies are created
SELECT
  'PHASE 35.1 RLS Policies configured successfully' as status,
  NOW() as timestamp;
