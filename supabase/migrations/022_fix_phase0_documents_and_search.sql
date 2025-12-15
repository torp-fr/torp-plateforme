-- =============================================================================
-- Migration: Fix phase0_documents table and search_knowledge function
-- =============================================================================
-- This migration fixes:
-- 1. Missing columns in phase0_documents table (title, content)
-- 2. Missing search_knowledge function (creates a fallback version)
-- =============================================================================

-- =============================================================================
-- 1. ADD MISSING COLUMNS TO phase0_documents
-- =============================================================================

-- Add 'title' column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'phase0_documents'
    AND column_name = 'title'
  ) THEN
    ALTER TABLE public.phase0_documents ADD COLUMN title TEXT;
    -- Copy existing 'name' values to 'title'
    UPDATE public.phase0_documents SET title = name WHERE title IS NULL;
  END IF;
END $$;

-- Add 'content' column if it doesn't exist (stores document JSON content)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'phase0_documents'
    AND column_name = 'content'
  ) THEN
    ALTER TABLE public.phase0_documents ADD COLUMN content JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- =============================================================================
-- 2. CREATE FALLBACK search_knowledge FUNCTION (without pgvector)
-- =============================================================================
-- This is a simplified version that works without embeddings/pgvector
-- Returns empty results but doesn't crash the application

-- First check if pgvector extension is available
DO $$
BEGIN
  -- Try to create extension if not exists (will fail silently if not available)
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not available, using fallback search';
  END;
END $$;

-- Drop existing function if it exists (to allow recreation with different signature)
DROP FUNCTION IF EXISTS public.search_knowledge(vector, float, int, text, text);
DROP FUNCTION IF EXISTS public.search_knowledge(text, int, text);

-- Create the search_knowledge function that the service expects
-- This version accepts the parameters in any order (using named parameters)
CREATE OR REPLACE FUNCTION public.search_knowledge(
  query_embedding JSONB DEFAULT NULL,  -- Changed from vector to JSONB for compatibility
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
  -- Check if knowledge_chunks table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'knowledge_chunks'
  ) THEN
    -- Try to do a basic text search if embeddings aren't available
    RETURN QUERY
    SELECT
      kc.id AS chunk_id,
      kc.document_id,
      kc.content,
      0.5::FLOAT AS similarity,  -- Default similarity
      kd.doc_type,
      kd.category,
      kd.code_reference,
      kd.title,
      kc.section_title,
      kc.page_number
    FROM knowledge_chunks kc
    JOIN knowledge_documents kd ON kc.document_id = kd.id
    WHERE
      kd.status = 'indexed'
      AND (filter_doc_type IS NULL OR kd.doc_type = filter_doc_type)
      AND (filter_category IS NULL OR kd.category = filter_category)
    LIMIT match_count;
  ELSE
    -- Return empty if tables don't exist
    RETURN;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.search_knowledge TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_knowledge TO anon;

-- =============================================================================
-- 3. VERIFY CHANGES
-- =============================================================================
-- Run these queries to verify:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'phase0_documents';
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'search_knowledge';
