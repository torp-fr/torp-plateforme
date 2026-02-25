-- PHASE 36.8: Knowledge Chunks Storage for Scalable Ingestion
-- Enables chunking of large documents with per-chunk embeddings

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,                 -- Position in document (0-based)
  content TEXT NOT NULL,                        -- Chunk text content
  token_count INTEGER,                          -- Estimated token count for tracking
  embedding VECTOR(1536) DEFAULT NULL,         -- Per-chunk embedding (pgvector)
  embedding_generated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT chunk_index_non_negative CHECK (chunk_index >= 0),
  CONSTRAINT token_count_non_negative CHECK (token_count IS NULL OR token_count > 0),
  CONSTRAINT content_not_empty CHECK (content != '')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chunks_document_id
  ON knowledge_chunks(document_id);

CREATE INDEX IF NOT EXISTS idx_chunks_document_chunk_index
  ON knowledge_chunks(document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_chunks_embedding_generated
  ON knowledge_chunks(embedding_generated_at)
  WHERE embedding_generated_at IS NOT NULL;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_knowledge_chunks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_knowledge_chunks_updated_at
  BEFORE UPDATE ON knowledge_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_chunks_updated_at();

-- RLS Policies (inherit from knowledge_documents)
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_chunks_read_authenticated" ON knowledge_chunks
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "knowledge_chunks_insert_admin" ON knowledge_chunks
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "knowledge_chunks_update_admin" ON knowledge_chunks
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "knowledge_chunks_delete_admin" ON knowledge_chunks
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );
