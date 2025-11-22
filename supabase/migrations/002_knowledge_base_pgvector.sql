-- ============================================
-- Migration: Knowledge Base avec pgvector
-- Pour stocker DTU, réglementations, bonnes pratiques
-- ============================================

-- 1. Activer l'extension pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Table des documents sources
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Métadonnées document
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,

  -- Classification
  doc_type TEXT NOT NULL CHECK (doc_type IN ('dtu', 'norme', 'reglementation', 'guide', 'fiche_technique', 'autre')),
  category TEXT, -- isolation, chauffage, electricite, etc.
  subcategory TEXT,

  -- Métadonnées métier
  code_reference TEXT, -- ex: DTU 45.1, NF C 15-100
  title TEXT,
  version TEXT,
  date_publication DATE,
  date_validite DATE,
  organisme TEXT, -- CSTB, AFNOR, FFB, etc.

  -- Statut traitement
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'indexed', 'error')),
  chunks_count INTEGER DEFAULT 0,
  processing_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  indexed_at TIMESTAMPTZ
);

-- 3. Table des chunks (morceaux de documents)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,

  -- Contenu
  content TEXT NOT NULL,
  content_length INTEGER NOT NULL,

  -- Position dans le document
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  section_title TEXT,

  -- Embedding (1536 dimensions pour OpenAI, 1024 pour autres)
  embedding vector(1536),

  -- Métadonnées pour le retrieval
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Index pour recherche vectorielle (HNSW pour performance)
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
ON knowledge_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 5. Index classiques
CREATE INDEX IF NOT EXISTS knowledge_documents_type_idx ON knowledge_documents(doc_type);
CREATE INDEX IF NOT EXISTS knowledge_documents_category_idx ON knowledge_documents(category);
CREATE INDEX IF NOT EXISTS knowledge_documents_status_idx ON knowledge_documents(status);
CREATE INDEX IF NOT EXISTS knowledge_documents_code_ref_idx ON knowledge_documents(code_reference);
CREATE INDEX IF NOT EXISTS knowledge_chunks_document_idx ON knowledge_chunks(document_id);

-- 6. Fonction de recherche sémantique
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(1536),
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
  RETURN QUERY
  SELECT
    kc.id AS chunk_id,
    kc.document_id,
    kc.content,
    1 - (kc.embedding <=> query_embedding) AS similarity,
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
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
    AND (filter_doc_type IS NULL OR kd.doc_type = filter_doc_type)
    AND (filter_category IS NULL OR kd.category = filter_category)
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 7. Fonction pour compter les documents par catégorie
CREATE OR REPLACE FUNCTION get_knowledge_stats()
RETURNS TABLE (
  doc_type TEXT,
  category TEXT,
  doc_count BIGINT,
  chunks_count BIGINT,
  total_size BIGINT
)
LANGUAGE SQL
AS $$
  SELECT
    kd.doc_type,
    kd.category,
    COUNT(DISTINCT kd.id) AS doc_count,
    SUM(kd.chunks_count) AS chunks_count,
    SUM(kd.file_size) AS total_size
  FROM knowledge_documents kd
  WHERE kd.status = 'indexed'
  GROUP BY kd.doc_type, kd.category
  ORDER BY doc_count DESC;
$$;

-- 8. Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_knowledge_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_documents_updated
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_timestamp();

-- 9. RLS Policies (optionnel, à adapter selon vos besoins)
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour les documents indexés
CREATE POLICY "Public read indexed documents" ON knowledge_documents
  FOR SELECT USING (status = 'indexed');

CREATE POLICY "Public read chunks" ON knowledge_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM knowledge_documents kd
      WHERE kd.id = knowledge_chunks.document_id
      AND kd.status = 'indexed'
    )
  );

-- Service role peut tout faire
CREATE POLICY "Service role full access documents" ON knowledge_documents
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access chunks" ON knowledge_chunks
  FOR ALL USING (auth.role() = 'service_role');
