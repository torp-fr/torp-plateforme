-- PHASE 29 — KNOWLEDGE INGESTION & DOCTRINE ACTIVATION
-- Migration: Knowledge Base Tables
-- Date: 2026-02-16
-- Status: Production-Ready

-- ============================================================================
-- TABLE: knowledge_documents
-- ============================================================================
-- Stores document metadata for ingested knowledge items
-- Tracks source, version, size, and chunk count

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Document metadata
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  source VARCHAR(255),
  version VARCHAR(50) DEFAULT '1.0',

  -- Storage metrics
  file_size INTEGER NOT NULL,
  chunk_count INTEGER DEFAULT 0,

  -- Audit trail
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_category CHECK (
    category IN ('norme', 'fiche_technique', 'jurisprudence', 'manuel', 'autre')
  ),
  CONSTRAINT valid_file_size CHECK (file_size > 0),
  CONSTRAINT valid_chunk_count CHECK (chunk_count >= 0)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_created_by
  ON knowledge_documents(created_by);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_category
  ON knowledge_documents(category);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_created_at
  ON knowledge_documents(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_source
  ON knowledge_documents(source) WHERE source IS NOT NULL;

-- ============================================================================
-- TABLE: knowledge_chunks
-- ============================================================================
-- Stores document chunks with embeddings
-- Foreign key cascade delete ensures cleanup when document is removed
-- Embedding column ready for pgvector extension (Phase 30)

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Document relationship
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,

  -- Chunk content and metadata
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  token_count INTEGER NOT NULL,

  -- Embedding storage (Phase 28-29: JSON, Phase 30: pgvector)
  embedding VECTOR(384) DEFAULT NULL,

  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_token_count CHECK (token_count > 0),
  CONSTRAINT unique_chunk_index UNIQUE(document_id, chunk_index),
  CONSTRAINT content_not_empty CHECK (LENGTH(content) > 0)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id
  ON knowledge_chunks(document_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_token_count
  ON knowledge_chunks(token_count);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_created_at
  ON knowledge_chunks(created_at DESC);

-- Full-text search index (Phase 29+)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_content_fts
  ON knowledge_chunks USING GIN(to_tsvector('french', content));

-- ============================================================================
-- FUNCTION: update_knowledge_documents_timestamp
-- ============================================================================
-- Automatically updates updated_at timestamp on document changes

CREATE OR REPLACE FUNCTION update_knowledge_documents_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_documents_updated_at
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_documents_timestamp();

-- ============================================================================
-- FUNCTION: update_knowledge_chunks_timestamp
-- ============================================================================
-- Automatically updates updated_at timestamp on chunk changes

CREATE OR REPLACE FUNCTION update_knowledge_chunks_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_chunks_updated_at
  BEFORE UPDATE ON knowledge_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_chunks_timestamp();

-- ============================================================================
-- FUNCTION: update_document_chunk_count
-- ============================================================================
-- Automatically updates chunk_count on knowledge_documents when chunks are added/removed

CREATE OR REPLACE FUNCTION update_document_chunk_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE knowledge_documents
    SET chunk_count = chunk_count + 1
    WHERE id = NEW.document_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE knowledge_documents
    SET chunk_count = chunk_count - 1
    WHERE id = OLD.document_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_chunks_count_update
  AFTER INSERT OR DELETE ON knowledge_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_document_chunk_count();

-- ============================================================================
-- VIEW: knowledge_documents_stats
-- ============================================================================
-- Provides aggregated statistics on knowledge base

CREATE OR REPLACE VIEW knowledge_documents_stats AS
SELECT
  COUNT(DISTINCT d.id) as document_count,
  COUNT(c.id) as chunk_count,
  SUM(d.file_size) as total_file_size,
  AVG(d.file_size) as avg_file_size,
  MAX(d.created_at) as latest_document_created
FROM knowledge_documents d
LEFT JOIN knowledge_chunks c ON d.id = c.document_id;

-- ============================================================================
-- VIEW: documents_by_category
-- ============================================================================
-- Breakdown of documents and chunks by category

CREATE OR REPLACE VIEW documents_by_category AS
SELECT
  d.category,
  COUNT(DISTINCT d.id) as document_count,
  COUNT(c.id) as chunk_count,
  SUM(d.file_size) as total_size,
  AVG(c.token_count) as avg_tokens_per_chunk
FROM knowledge_documents d
LEFT JOIN knowledge_chunks c ON d.id = c.document_id
GROUP BY d.category;

-- ============================================================================
-- RLS POLICIES (Enable if needed)
-- ============================================================================
-- Uncomment these rows if Row-Level Security should be enabled
-- Note: Update with your actual auth policies

/*
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Allow users to view only documents they created
CREATE POLICY select_own_documents ON knowledge_documents
  FOR SELECT USING (auth.uid() = created_by);

-- Allow service role to access all documents
CREATE POLICY service_role_access ON knowledge_documents
  FOR ALL USING (auth.role() = 'service_role');

-- Allow users to view chunks from their documents
CREATE POLICY select_own_chunks ON knowledge_chunks
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM knowledge_documents
      WHERE created_by = auth.uid()
    )
  );
*/

-- ============================================================================
-- PHASE 30 PREPARATION: pgvector Extension
-- ============================================================================
-- The following commands are for Phase 30 implementation
-- Run these AFTER upgrading to Phase 30 with vector search support

/*
-- Enable pgvector extension (Phase 30)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create vector index for ultra-fast semantic search (Phase 30)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

-- Alternative: Flat index for smaller datasets
-- CREATE INDEX idx_knowledge_chunks_embedding_flat
--   ON knowledge_chunks
--   USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);
*/

-- ============================================================================
-- DATA CONSISTENCY CHECKS
-- ============================================================================

-- No data migration needed - this is initial schema creation for Phase 29
-- Existing knowledge_documents and knowledge_chunks tables are preserved if they exist

-- Verify tables were created
SELECT
  schemaname,
  tablename
FROM pg_tables
WHERE tablename IN ('knowledge_documents', 'knowledge_chunks')
  AND schemaname = 'public';

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- If needed to rollback this migration:
--
-- DROP TRIGGER IF EXISTS knowledge_chunks_count_update ON knowledge_chunks;
-- DROP TRIGGER IF EXISTS knowledge_chunks_updated_at ON knowledge_chunks;
-- DROP TRIGGER IF EXISTS knowledge_documents_updated_at ON knowledge_documents;
-- DROP FUNCTION IF EXISTS update_document_chunk_count();
-- DROP FUNCTION IF EXISTS update_knowledge_chunks_timestamp();
-- DROP FUNCTION IF EXISTS update_knowledge_documents_timestamp();
-- DROP VIEW IF EXISTS documents_by_category;
-- DROP VIEW IF EXISTS knowledge_documents_stats;
-- DROP TABLE IF EXISTS knowledge_chunks;
-- DROP TABLE IF EXISTS knowledge_documents;
