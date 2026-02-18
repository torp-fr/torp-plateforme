-- PHASE 35: Knowledge Brain - Vector Embeddings for Semantic Search
-- Ensure pgvector is available (created in previous migration)

CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  embedding vector(1536),                  -- OpenAI embedding vector (1536 dimensions)
  chunk_index INTEGER DEFAULT 0,           -- For documents split into multiple chunks
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT embedding_not_null CHECK (embedding IS NOT NULL),
  UNIQUE(document_id, chunk_index)
);

-- Indexes for vector similarity search
CREATE INDEX idx_knowledge_embeddings_document_id ON knowledge_embeddings(document_id);
CREATE INDEX idx_knowledge_embeddings_vector ON knowledge_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS Policies
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_embeddings_read_authenticated" ON knowledge_embeddings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "knowledge_embeddings_insert_admin" ON knowledge_embeddings
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "knowledge_embeddings_delete_admin" ON knowledge_embeddings
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- Helper view for semantic search (join with documents)
CREATE OR REPLACE VIEW knowledge_search_index AS
SELECT
  ke.id as embedding_id,
  ke.embedding,
  kd.id as document_id,
  kd.source,
  kd.category,
  kd.region,
  kd.content,
  kd.reliability_score,
  kd.is_active
FROM knowledge_embeddings ke
JOIN knowledge_documents kd ON ke.document_id = kd.id
WHERE kd.is_active = true;

-- RLS for view
ALTER VIEW knowledge_search_index OWNER TO postgres;
