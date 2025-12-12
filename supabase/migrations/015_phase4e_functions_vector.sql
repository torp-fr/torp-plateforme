-- =====================================================
-- TORP Security Fixes - PHASE 4E: FONCTIONS VECTORIELLES
-- Description: Fonctions de recherche vectorielle (embeddings)
-- Exécuter après Phase 4D
-- =====================================================

-- Note: Les tables rag_chunks, rag_documents, market_prices, technical_norms
-- n'existent pas. On utilise knowledge_documents et knowledge_chunks.
-- DROP FUNCTION ajoutés pour éviter les erreurs de changement de type

-- 4.37 match_knowledge_chunks
DROP FUNCTION IF EXISTS public.match_knowledge_chunks(vector, FLOAT, INT) CASCADE;
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE kc.embedding IS NOT NULL
  AND kd.status = 'indexed'
  AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4.38 hybrid_search_knowledge
DROP FUNCTION IF EXISTS public.hybrid_search_knowledge(TEXT, vector, INT, FLOAT) CASCADE;
CREATE OR REPLACE FUNCTION public.hybrid_search_knowledge(
  query_text TEXT,
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  keyword_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  doc_type TEXT,
  combined_score FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kd.doc_type,
    (
      (1 - keyword_weight) * (1 - (kc.embedding <=> query_embedding)) +
      keyword_weight * ts_rank(to_tsvector('french', kc.content), plainto_tsquery('french', query_text))
    ) AS combined_score
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE kc.embedding IS NOT NULL
  AND kd.status = 'indexed'
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- 4.39 match_knowledge
DROP FUNCTION IF EXISTS public.match_knowledge(vector, FLOAT, INT) CASCADE;
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  source_type TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kd.doc_type as source_type,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE kc.embedding IS NOT NULL
  AND kd.status = 'indexed'
  AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4.40 search_knowledge_text
DROP FUNCTION IF EXISTS public.search_knowledge_text(TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.search_knowledge_text(
  query_text TEXT,
  filter_type TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  source_type TEXT,
  rank FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kd.doc_type as source_type,
    ts_rank(to_tsvector('french', kc.content), plainto_tsquery('french', query_text)) AS rank
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE kd.status = 'indexed'
  AND to_tsvector('french', kc.content) @@ plainto_tsquery('french', query_text)
  AND (filter_type IS NULL OR kd.doc_type = filter_type)
  ORDER BY rank DESC
  LIMIT 20;
END;
$$;

-- 4.41 match_market_data
DROP FUNCTION IF EXISTS public.match_market_data(TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.match_market_data(
  p_region TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_work_type TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  work_type TEXT,
  price_low DECIMAL,
  price_high DECIMAL,
  price_avg DECIMAL,
  region TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.work_type,
    m.price_low,
    m.price_high,
    m.price_avg,
    m.region
  FROM public.market_data m
  WHERE (p_region IS NULL OR m.region = p_region)
  AND (p_category IS NULL OR m.category = p_category)
  AND (p_work_type IS NULL OR m.work_type ILIKE '%' || p_work_type || '%')
  ORDER BY m.category, m.work_type
  LIMIT 50;
END;
$$;

-- =====================================================
-- FIN PHASE 4E
-- =====================================================
