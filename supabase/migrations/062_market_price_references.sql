-- PHASE 35: Knowledge Brain - Market Price References
-- Store market pricing data for intelligent price analysis

CREATE TABLE IF NOT EXISTS market_price_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_travaux TEXT NOT NULL,              -- 'rénovation', 'isolation', 'chauffage', etc.
  region TEXT NOT NULL,                    -- Region code (75, IDF, etc.)
  min_price NUMERIC(10,2) NOT NULL,        -- Minimum market price
  avg_price NUMERIC(10,2) NOT NULL,        -- Average market price
  max_price NUMERIC(10,2) NOT NULL,        -- Maximum market price
  source TEXT NOT NULL,                    -- 'market_survey', 'user_feedback', 'public_data'
  data_count INTEGER DEFAULT 1,            -- Number of data points aggregated
  reliability_score INTEGER DEFAULT 50,    -- 0-100 confidence level
  metadata JSONB DEFAULT '{}',             -- Additional context (unit, surface, etc.)
  is_active BOOLEAN DEFAULT true,          -- Soft delete
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT price_range_valid CHECK (min_price <= avg_price AND avg_price <= max_price),
  CONSTRAINT reliability_score_range CHECK (reliability_score >= 0 AND reliability_score <= 100),
  CONSTRAINT data_count_positive CHECK (data_count > 0)
);

-- Indexes for efficient lookups
CREATE INDEX idx_market_price_type_travaux ON market_price_references(type_travaux);
CREATE INDEX idx_market_price_region ON market_price_references(region);
CREATE INDEX idx_market_price_composite ON market_price_references(type_travaux, region);
CREATE INDEX idx_market_price_active_reliability ON market_price_references(is_active, reliability_score DESC);

-- RLS Policies
ALTER TABLE market_price_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_price_references_read_authenticated" ON market_price_references
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "market_price_references_insert_admin" ON market_price_references
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "market_price_references_update_admin" ON market_price_references
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "market_price_references_delete_admin" ON market_price_references
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_market_price_references_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_market_price_references_updated_at
  BEFORE UPDATE ON market_price_references
  FOR EACH ROW
  EXECUTE FUNCTION update_market_price_references_updated_at();

-- Helper function to get market price range for analysis
CREATE OR REPLACE FUNCTION get_market_price_range(
  p_type_travaux TEXT,
  p_region TEXT DEFAULT NULL
)
RETURNS TABLE (
  min_price NUMERIC,
  avg_price NUMERIC,
  max_price NUMERIC,
  reliability_score INTEGER,
  data_count INTEGER
) AS $$
SELECT
  min_price,
  avg_price,
  max_price,
  reliability_score,
  data_count
FROM market_price_references
WHERE
  type_travaux = p_type_travaux
  AND (p_region IS NULL OR region = p_region)
  AND is_active = true
ORDER BY reliability_score DESC, updated_at DESC
LIMIT 1;
$$ LANGUAGE sql;
