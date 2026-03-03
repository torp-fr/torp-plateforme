-- =============================================================================
-- QUICK FIX: Add missing columns to phase0_documents
-- =============================================================================
-- Run this in Supabase SQL Editor to fix document generation errors
-- =============================================================================

-- 1. Add 'title' column
ALTER TABLE public.phase0_documents ADD COLUMN IF NOT EXISTS title TEXT;

-- 2. Add 'content' column for storing document JSON
ALTER TABLE public.phase0_documents ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '{}'::jsonb;

-- 3. Copy existing 'name' values to 'title' if needed
UPDATE public.phase0_documents SET title = name WHERE title IS NULL AND name IS NOT NULL;

-- =============================================================================
-- OPTIONAL: Create fallback search_knowledge function
-- =============================================================================
-- This creates a simple version that won't crash even without pgvector

CREATE OR REPLACE FUNCTION public.search_knowledge(
  query_embedding JSONB DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_doc_type TEXT DEFAULT NULL,
  filter_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT,
  doc_type TEXT,
  category TEXT,
  code_reference TEXT,
  title TEXT,
  section_title TEXT,
  page_number INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Return empty results (RAG not configured)
  RETURN;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.search_knowledge TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_knowledge TO anon;

-- =============================================================================
-- VERIFY: Check that columns were added
-- =============================================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'phase0_documents'
ORDER BY ordinal_position;
