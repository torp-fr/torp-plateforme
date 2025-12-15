-- Migration: 031_knowledge_collections.sql
-- Description: Add knowledge collections management for RAG system
-- Date: 2025-12-15

-- =============================================================================
-- KNOWLEDGE COLLECTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.knowledge_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(50), -- 'dtu', 'materiaux', 'cctp', 'prix', 'reglementation', 'aides'

  -- Statistics
  document_count INT DEFAULT 0,
  chunk_count INT DEFAULT 0,
  total_tokens INT DEFAULT 0,

  -- Configuration
  embedding_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
  chunk_size INT DEFAULT 1500,
  chunk_overlap INT DEFAULT 200,

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false, -- System collections cannot be deleted
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- =============================================================================
-- ADD COLLECTION REFERENCE TO KNOWLEDGE_CHUNKS
-- =============================================================================

-- Add collection_id to knowledge_chunks if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_chunks' AND column_name = 'collection_id'
  ) THEN
    ALTER TABLE public.knowledge_chunks
    ADD COLUMN collection_id UUID REFERENCES public.knowledge_collections(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add collection_id to knowledge_documents if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_documents' AND column_name = 'collection_id'
  ) THEN
    ALTER TABLE public.knowledge_documents
    ADD COLUMN collection_id UUID REFERENCES public.knowledge_collections(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_knowledge_collections_slug ON public.knowledge_collections(slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_collections_category ON public.knowledge_collections(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_collections_active ON public.knowledge_collections(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_collection ON public.knowledge_chunks(collection_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_collection ON public.knowledge_documents(collection_id);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.knowledge_collections ENABLE ROW LEVEL SECURITY;

-- Everyone can read active collections
CREATE POLICY "Anyone can view active collections"
  ON public.knowledge_collections
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Service role can manage all
CREATE POLICY "Service role full access to collections"
  ON public.knowledge_collections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to update collection statistics
CREATE OR REPLACE FUNCTION update_collection_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Update document count and chunk count
    UPDATE public.knowledge_collections
    SET
      document_count = (
        SELECT COUNT(*) FROM public.knowledge_documents
        WHERE collection_id = NEW.collection_id
      ),
      chunk_count = (
        SELECT COUNT(*) FROM public.knowledge_chunks kc
        JOIN public.knowledge_documents kd ON kc.document_id = kd.id
        WHERE kd.collection_id = NEW.collection_id
      ),
      updated_at = NOW()
    WHERE id = NEW.collection_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.knowledge_collections
    SET
      document_count = (
        SELECT COUNT(*) FROM public.knowledge_documents
        WHERE collection_id = OLD.collection_id
      ),
      chunk_count = (
        SELECT COUNT(*) FROM public.knowledge_chunks kc
        JOIN public.knowledge_documents kd ON kc.document_id = kd.id
        WHERE kd.collection_id = OLD.collection_id
      ),
      updated_at = NOW()
    WHERE id = OLD.collection_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update stats on document changes
DROP TRIGGER IF EXISTS trigger_update_collection_stats ON public.knowledge_documents;
CREATE TRIGGER trigger_update_collection_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION update_collection_stats();

-- Function to search within a specific collection
CREATE OR REPLACE FUNCTION search_collection(
  p_collection_slug VARCHAR,
  p_query_embedding vector(1536),
  p_match_threshold FLOAT DEFAULT 0.7,
  p_match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  page_number INT,
  section_title VARCHAR,
  similarity FLOAT,
  document_title VARCHAR,
  document_category VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.document_id,
    kc.content,
    kc.page_number,
    kc.section_title,
    1 - (kc.embedding <=> p_query_embedding) AS similarity,
    kd.title AS document_title,
    kd.category AS document_category
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kc.document_id = kd.id
  JOIN public.knowledge_collections kcol ON kd.collection_id = kcol.id
  WHERE
    kcol.slug = p_collection_slug
    AND kcol.is_active = true
    AND kc.embedding IS NOT NULL
    AND 1 - (kc.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY kc.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- SEED DEFAULT COLLECTIONS
-- =============================================================================

INSERT INTO public.knowledge_collections (name, slug, description, category, is_system, metadata)
VALUES
  ('DTU et Normes', 'dtu_normes', 'Documents Techniques Unifiés et normes de construction', 'dtu', true, '{"priority": 1}'),
  ('Matériaux BTP', 'materiaux_btp', 'Fiches techniques des matériaux de construction', 'materiaux', true, '{"priority": 2}'),
  ('Modèles CCTP', 'cctp_templates', 'Modèles et templates de CCTP par lot', 'cctp', true, '{"priority": 3}'),
  ('Prix de Référence', 'prix_reference', 'Prix de référence des travaux (type Batiprix)', 'prix', true, '{"priority": 4}'),
  ('Réglementation', 'reglementation', 'Textes réglementaires (Code construction, urbanisme)', 'reglementation', true, '{"priority": 5}'),
  ('Aides Financières', 'aides_financieres', 'Documentation sur les aides (MaPrimeRénov, CEE, etc.)', 'aides', true, '{"priority": 6}'),
  ('Pathologies Bâtiment', 'pathologies_btp', 'Guide des pathologies et désordres du bâtiment', 'pathologies', true, '{"priority": 7}'),
  ('Risques Chantier', 'risques_chantier', 'Documentation sur la prévention des risques', 'risques', true, '{"priority": 8}')
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.knowledge_collections IS 'Collections de documents pour le système RAG';
COMMENT ON COLUMN public.knowledge_collections.slug IS 'Identifiant unique URL-friendly';
COMMENT ON COLUMN public.knowledge_collections.is_system IS 'Collections système ne peuvent pas être supprimées';
COMMENT ON FUNCTION search_collection IS 'Recherche sémantique dans une collection spécifique';
