-- =====================================================
-- TORP Security Fixes - PHASE 4E: FONCTIONS VECTORIELLES
-- Description: Fonctions de recherche vectorielle (embeddings)
-- Exécuter après Phase 4D
-- =====================================================

-- 4.37 match_documents
CREATE OR REPLACE FUNCTION public.match_documents(
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
    c.id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.rag_chunks c
  WHERE c.embedding IS NOT NULL
  AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4.38 hybrid_search_documents
CREATE OR REPLACE FUNCTION public.hybrid_search_documents(
  query_text TEXT,
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  keyword_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  metadata JSONB,
  combined_score FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.content,
    c.metadata,
    (
      (1 - keyword_weight) * (1 - (c.embedding <=> query_embedding)) +
      keyword_weight * ts_rank(to_tsvector('french', c.content), plainto_tsquery('french', query_text))
    ) AS combined_score
  FROM public.rag_chunks c
  WHERE c.embedding IS NOT NULL
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- 4.39 match_knowledge
-- Note: Utilise knowledge_chunks et knowledge_documents (pas knowledge_base)
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
-- Note: La fonction search_knowledge existe déjà dans migration 002
-- On crée une variante pour recherche textuelle
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

-- 4.41 match_market_prices
CREATE OR REPLACE FUNCTION public.match_market_prices(
  query_embedding vector(1536),
  region TEXT DEFAULT NULL,
  category TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  work_type TEXT,
  price_min DECIMAL,
  price_max DECIMAL,
  similarity FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.sub_category,
    m.price_min,
    m.price_max,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.market_prices m
  WHERE m.embedding IS NOT NULL
  AND (region IS NULL OR m.region_code = region)
  AND (category IS NULL OR m.category = category)
  ORDER BY m.embedding <=> query_embedding
  LIMIT 10;
END;
$$;

-- 4.42 match_technical_norms
CREATE OR REPLACE FUNCTION public.match_technical_norms(
  query_embedding vector(1536),
  norm_type TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  code TEXT,
  title TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.code,
    n.title,
    n.content,
    1 - (n.embedding <=> query_embedding) AS similarity
  FROM public.technical_norms n
  WHERE n.embedding IS NOT NULL
  AND (norm_type IS NULL OR n.norm_type = norm_type)
  ORDER BY n.embedding <=> query_embedding
  LIMIT 10;
END;
$$;

-- =====================================================
-- FIN PHASE 4E
-- =====================================================
