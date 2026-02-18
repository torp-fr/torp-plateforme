-- PHASE 36 Extension: Add PRICING_REFERENCE category
-- Allow specialized pricing reference documents

ALTER TABLE knowledge_documents
DROP CONSTRAINT IF EXISTS valid_category;

ALTER TABLE knowledge_documents
ADD CONSTRAINT valid_category CHECK (
  category IN (
    'DTU',
    'EUROCODE',
    'NORM',
    'REGULATION',
    'GUIDELINE',
    'BEST_PRACTICE',
    'TECHNICAL_GUIDE',
    'TRAINING',
    'MANUAL',
    'HANDBOOK',
    'SUSTAINABILITY',
    'ENERGY_EFFICIENCY',
    'LEGAL',
    'LIABILITY',
    'WARRANTY',
    'CASE_STUDY',
    'LESSONS_LEARNED',
    'PRICING_REFERENCE'
  )
);

-- Add column to track pricing extraction
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS pricing_data JSONB;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS is_pricing_reference BOOLEAN DEFAULT false;

-- Index for pricing lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_pricing_reference ON knowledge_documents(is_pricing_reference, category, region);

-- Comment
COMMENT ON COLUMN knowledge_documents.pricing_data IS 'Extracted pricing data: {min, avg, max, currency, unit, type_travaux}';
COMMENT ON COLUMN knowledge_documents.is_pricing_reference IS 'TRUE if this is a pricing reference document with extracted data';
