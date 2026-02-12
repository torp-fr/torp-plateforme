-- Knowledge Base Vectorisée - TORP
-- Migration pour pgvector et tables de stockage des embeddings

-- 1. Créer extension pgvector (si pas existante)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Créer table: knowledge_base_documents
CREATE TABLE IF NOT EXISTS knowledge_base_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  doc_type VARCHAR NOT NULL CHECK (doc_type IN ('norm', 'guide', 'practice', 'pricing')),
  source_file VARCHAR,
  uploaded_at TIMESTAMP DEFAULT now(),
  status VARCHAR DEFAULT 'raw' CHECK (status IN ('raw', 'processing', 'vectorized')),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 3. Créer table: knowledge_base_chunks
CREATE TABLE IF NOT EXISTS knowledge_base_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES knowledge_base_documents(id) ON DELETE CASCADE,
  section_id VARCHAR,
  content TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- 4. Créer index pour vector search (recherche par similarité cosinus)
CREATE INDEX IF NOT EXISTS idx_kb_embedding ON knowledge_base_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 5. Créer index pour recherche par type de document
CREATE INDEX IF NOT EXISTS idx_kb_doc_type ON knowledge_base_documents(doc_type);

-- 6. Créer index pour recherche par keywords
CREATE INDEX IF NOT EXISTS idx_kb_keywords ON knowledge_base_chunks USING GIN(keywords);

-- 7. Créer index pour recherche par doc_id
CREATE INDEX IF NOT EXISTS idx_kb_doc_id ON knowledge_base_chunks(doc_id);

-- 8. Activer RLS pour sécurité
ALTER TABLE knowledge_base_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_chunks ENABLE ROW LEVEL SECURITY;

-- 9. Créer policies (public read, admin write)
CREATE POLICY "public_read_kb_documents" ON knowledge_base_documents
  FOR SELECT USING (true);

CREATE POLICY "public_read_kb_chunks" ON knowledge_base_chunks
  FOR SELECT USING (true);

CREATE POLICY "admin_write_kb_documents" ON knowledge_base_documents
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "admin_write_kb_chunks" ON knowledge_base_chunks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 10. Créer fonction de recherche vectorielle
CREATE OR REPLACE FUNCTION search_kb_by_similarity(
  query_embedding vector,
  match_count integer DEFAULT 5,
  distance_threshold float DEFAULT 0.3
)
RETURNS TABLE(
  chunk_id UUID,
  doc_id UUID,
  content TEXT,
  similarity float,
  metadata JSONB
) LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_base_chunks.id,
    knowledge_base_chunks.doc_id,
    knowledge_base_chunks.content,
    (1 - (knowledge_base_chunks.embedding <=> query_embedding))::float as similarity,
    knowledge_base_chunks.metadata
  FROM knowledge_base_chunks
  WHERE (1 - (knowledge_base_chunks.embedding <=> query_embedding)) > distance_threshold
  ORDER BY knowledge_base_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 11. Créer table pour stockage des analyses (préparation)
CREATE TABLE IF NOT EXISTS kb_analysis_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  results_count INTEGER,
  created_at TIMESTAMP DEFAULT now()
);

-- 12. Grants pour lecture publique
GRANT SELECT ON knowledge_base_documents TO anon;
GRANT SELECT ON knowledge_base_chunks TO anon;
GRANT EXECUTE ON FUNCTION search_kb_by_similarity TO anon;
